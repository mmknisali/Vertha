import logging
import os
import re
import asyncio
from pathlib import Path

from duckduckgo_search import DDGS
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from httpx import AsyncClient
from pydantic import BaseModel

logger = logging.getLogger('vertha-search')

load_dotenv(Path(__file__).parent / '.env.local')

ZEN_API_KEY = os.getenv('ZEN_API_KEY', '')
ZEN_API_URL = 'https://opencode.ai/zen/v1/chat/completions'

router = APIRouter(prefix='/search', tags=['search'])

SEARCH_CACHE_DIR = Path.home() / '.local' / 'share' / 'vertha' / 'cache'
SEARCH_CACHE_DIR.mkdir(parents=True, exist_ok=True)
SEARCH_CACHE_TTL = 300

_cache = {}


class SearchRequest(BaseModel):
    question: str


class IntelligentSearchRequest(BaseModel):
    question: str


class IntelligentSearch:
    def __init__(self):
        self.last_search_time = 0
        self.search_delay = 2.0
        self.session = AsyncClient(
            timeout=8.0,
            follow_redirects=True,
            headers={
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0'
            }
        )

    async def _call_llm(self, messages: list[dict], max_tokens: int = 200) -> str:
        if not ZEN_API_KEY:
            raise RuntimeError('ZEN_API_KEY not configured')

        async with AsyncClient(timeout=30.0) as client:
            response = await client.post(
                ZEN_API_URL,
                json={
                    'model': 'big-pickle',
                    'messages': messages,
                    'max_tokens': max_tokens,
                    'reasoning_effort': 'low'
                },
                headers={'Authorization': f'Bearer {ZEN_API_KEY}'}
            )
            response.raise_for_status()
            data = response.json()
            msg = data['choices'][0]['message']
            return msg.get('content') or msg.get('reasoning_content', '')

    async def _extract_answer_from_reasoning(self, reasoning: str) -> str:
        reasoning = reasoning.strip()

        sentences = re.findall(r'[^.!?]+[.!?]', reasoning)

        if not sentences:
            return reasoning[-300:].strip()

        thinking_markers = [
            'i need to', 'i should', 'i think', 'let me', 'so i',
            'first,', 'next,', 'therefore,', 'based on',
            'the user', 'the instruction', 'the answer should',
            'maximum', 'synthesize', 'address the user',
            "i'll make sure", "i'll ensure", 'i have provided'
        ]

        for i in range(len(sentences) - 1, -1, -1):
            sentence = sentences[i].strip()
            lower_sentence = sentence.lower()

            if any(m in lower_sentence for m in thinking_markers):
                continue

            if 'sir,' in lower_sentence and len(sentence) < 50:
                continue

            if re.search(r'\n|^\s*[-*]|^\s*\d+\.', sentence):
                continue

            start_idx = max(0, i - 3)
            paragraph = ''.join(sentences[start_idx:i+1]).strip()
            if len(paragraph) > 20:
                return paragraph

        return ''.join(sentences[-4:]).strip()

    async def generate_queries(self, question: str) -> list[str]:
        return [question]

    async def search(self, query: str) -> list[dict]:
        now = asyncio.get_event_loop().time()
        elapsed = now - self.last_search_time
        if elapsed < self.search_delay:
            await asyncio.sleep(self.search_delay - elapsed)

        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=5, safesearch='off'))
            self.last_search_time = asyncio.get_event_loop().time()
            return results
        except Exception as e:
            logger.error(f'Search error for "{query}": {e}')
            await asyncio.sleep(5)
            try:
                with DDGS() as ddgs:
                    return list(ddgs.text(query, max_results=3))
            except:
                return []

    async def fetch_page(self, url: str) -> str | None:
        SKIP_DOMAINS = [
            'wsj.com', 'nytimes.com', 'ft.com',
            'bloomberg.com', 'economist.com',
            'reddit.com', 'twitter.com', 'x.com',
            'instagram.com', 'facebook.com'
        ]

        if any(domain in url for domain in SKIP_DOMAINS):
            return None

        try:
            response = await self.session.get(url)
            if response.status_code != 200:
                return None

            from bs4 import BeautifulSoup
            soup = BeautifulSoup(response.text, 'html.parser')

            for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', 'form', 'button']):
                tag.decompose()

            main = (soup.find('article') or
                    soup.find('main') or
                    soup.find(class_=re.compile(r'content|article|post|story', re.I)) or
                    soup.find('body'))

            if not main:
                return None

            text = main.get_text(separator=' ', strip=True)
            text = re.sub(r'\s+', ' ', text).strip()

            paywall_signals = [
                'subscribe to read', 'subscribe to continue',
                'sign in to read', 'create account to read',
                'premium content'
            ]
            if any(s in text.lower()[:500] for s in paywall_signals):
                return None

            return text[:2000] if len(text) > 100 else None

        except Exception:
            return None

    async def synthesize(self, question: str, search_results: list[dict], page_contents: list[str]) -> str:
        context_parts = []

        for r in search_results[:5]:
            if r.get('body'):
                context_parts.append(
                    f"Source ({r.get('href', 'unknown')}):\n{r['body']}"
                )

        for i, content in enumerate(page_contents):
            if content:
                context_parts.append(f'Full page {i+1}:\n{content}')

        if not context_parts:
            return "I searched but couldn't find reliable information on that, sir."

        context = '\n\n---\n\n'.join(context_parts)

        response = await self._call_llm(
            messages=[
                {'role': 'system', 'content': 'You are a voice assistant. Answer directly. 2-4 sentences. Start with "Sir". No lists.'},
                {'role': 'user', 'content': f'''Based on:

{context}

Question: {question}

Give a 2-4 sentence answer starting with "Sir".'''}
            ],
            max_tokens=600
        )

        response = response.strip()

        import re
        raw_response = response

        lines = raw_response.split('\n')
        for line in reversed(lines):
            line = line.strip()
            if line.lower().startswith('sir,'):
                if 30 < len(line) < 600 and line[-1] in '.!?':
                    return line

        quoted = re.findall(r'"(Sir,[^"]{30,500})"', raw_response)
        if quoted:
            for q in reversed(quoted):
                if q[-1] in '.!?':
                    return q

        quoted2 = re.findall(r"'(Sir,[^']{30,500})'", raw_response)
        if quoted2:
            for q in reversed(quoted2):
                if q[-1] in '.!?':
                    return q

        if raw_response.lower().startswith('sir,'):
            return raw_response[:500]

        return raw_response[:500] if len(raw_response) > 20 else raw_response

    async def full_search(self, question: str) -> tuple[str, list[str]]:
        queries = await self.generate_queries(question)

        all_results = []
        seen_urls = set()

        for query in queries:
            results = await self.search(query)
            for r in results:
                url = r.get('href', '')
                if url not in seen_urls:
                    seen_urls.add(url)
                    all_results.append(r)

        if not all_results:
            return ("I'm having trouble reaching the internet right now, sir.", [])

        top_urls = [r.get('href', '') for r in all_results[:3] if r.get('href')]

        page_contents = await asyncio.gather(
            *[self.fetch_page(url) for url in top_urls],
            return_exceptions=True
        )

        clean_contents = [c for c in page_contents if isinstance(c, str) and c]

        answer = await self.synthesize(question, all_results, clean_contents)

        sources = [r.get('href', '') for r in all_results[:3] if r.get('href')]

        return answer, sources


_intelligent_search = IntelligentSearch()


def _get_cached(query: str):
    key = query.lower().strip()
    if key in _cache:
        entry = _cache[key]
        if asyncio.get_event_loop().time() - entry['ts'] < SEARCH_CACHE_TTL:
            logger.info(f'Search cache hit: "{query}"')
            return entry['results']
        else:
            del _cache[key]
    return None


def _set_cached(query: str, results: list):
    key = query.lower().strip()
    _cache[key] = {'results': results, 'ts': asyncio.get_event_loop().time()}
    logger.info(f'Search cached: "{query}" -> {len(results)} results')


@router.post('')
async def web_search(req: SearchRequest):
    try:
        cached = _get_cached(req.query)
        if cached:
            return {'results': cached}

        logger.info(f'Web search: "{req.query}"')
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(req.query, max_results=5):
                results.append({
                    'title': r.get('title', ''),
                    'url': r.get('href', ''),
                    'snippet': r.get('body', ''),
                })

        _set_cached(req.query, results)
        return {'results': results}

    except Exception as e:
        logger.error(f'Search error: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/intelligent')
async def intelligent_search(req: IntelligentSearchRequest):
    try:
        logger.info(f'Intelligent search: "{req.question}"')
        answer, sources = await _intelligent_search.full_search(req.question)
        return {'answer': answer, 'sources': sources}
    except Exception as e:
        logger.error(f'Intelligent search error: {e}')
        raise HTTPException(status_code=500, detail=str(e))