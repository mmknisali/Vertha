{ pkgs, ... }: {
  packages = [
    pkgs.nodejs_20
    pkgs.python312
    pkgs.gcc
    pkgs.xdotool
    pkgs.wmctrl
    pkgs.xorg.xdpyinfo
    pkgs.procps
    pkgs.libglibutil
  ];

  enterShell = ''
    if [ ! -d node_modules ]; then
      echo "Installing npm dependencies..."
      npm install
    fi
    if [ ! -d .venv ]; then
      echo "Setting up Python venv..."
      ${pkgs.python312}/bin/python -m venv .venv
      .venv/bin/pip install -r requirements.txt
    fi
  '';

  processes = {
    vite.exec = ''
      exec npm run dev -- --port 5173 --strictPort
    '';
    stt-server.exec = ''
      export LD_PRELOAD=/nix/store/si4q3zks5mn5jhzzyri9hhd3cv789vlm-gcc-15.2.0-lib/lib/libstdc++.so.6
      export PYTHONPATH=/home/ali/workspace/mmknisali/vertha/src/stt
      exec .venv/bin/python -c "from uvicorn.main import run; run('server:app', host='0.0.0.0', port=8765)"
    '';
    tts-server.exec = ''
      export LD_PRELOAD=/nix/store/si4q3zks5mn5jhzzyri9hhd3cv789vlm-gcc-15.2.0-lib/lib/libstdc++.so.6
      export PYTHONPATH=/home/ali/workspace/mmknisali/vertha/src/tts
      exec .venv/bin/python -c "from uvicorn.main import run; run('server:app', host='0.0.0.0', port=8766)"
    '';
  };
}
