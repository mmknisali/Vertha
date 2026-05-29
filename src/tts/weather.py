import httpx
from fastapi import APIRouter

router = APIRouter(prefix='/weather', tags=['weather'])

WMO_MAP = {
    0: 'clear sky',
    1: 'mostly clear',
    2: 'partly cloudy',
    3: 'overcast',
    45: 'foggy',
    48: 'foggy',
    51: 'light drizzle',
    53: 'drizzle',
    55: 'drizzle',
    56: 'freezing drizzle',
    57: 'freezing drizzle',
    61: 'light rain',
    63: 'rain',
    65: 'heavy rain',
    66: 'light freezing rain',
    67: 'freezing rain',
    71: 'light snow',
    73: 'snow',
    75: 'heavy snow',
    77: 'snow grains',
    80: 'light rain showers',
    81: 'rain showers',
    82: 'heavy rain showers',
    85: 'light snow showers',
    86: 'snow showers',
    95: 'thunderstorm',
    96: 'thunderstorm with hail',
    99: 'thunderstorm with hail',
}


def map_condition(code: int) -> str:
    return WMO_MAP.get(code, 'unknown')


@router.get('')
async def get_weather(lat: float, lon: float):
    url = 'https://api.open-meteo.com/v1/forecast'
    params = {
        'latitude': lat,
        'longitude': lon,
        'current': 'temperature_2m,weather_code,relative_humidity_2m',
        'daily': 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        'timezone': 'auto',
        'forecast_days': 1,
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    current = data['current']
    daily = data['daily']

    return {
        'current_temp': round(current['temperature_2m']),
        'condition': map_condition(current['weather_code']),
        'high': round(daily['temperature_2m_max'][0]),
        'low': round(daily['temperature_2m_min'][0]),
        'rain_chance': daily['precipitation_probability_max'][0],
        'humidity': current['relative_humidity_2m'],
    }