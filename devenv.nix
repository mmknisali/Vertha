{ pkgs, ... }: {
  packages = [
    pkgs.nodejs_20
    pkgs.python312
    pkgs.gcc
    pkgs.xdotool
    pkgs.wmctrl
    pkgs.xorg.xdpyinfo
    pkgs.procps
  ];

  enterShell = ''
    if [ ! -d node_modules ]; then
      echo "Installing npm dependencies..."
      npm install
    fi
    for dir in stt tts; do
      VENV="src/$dir/.venv"
      if [ ! -d "$VENV" ]; then
        echo "Setting up $dir Python venv..."
        ${pkgs.python312}/bin/python -m venv "$VENV"
        "$VENV/bin/pip" install -r "src/$dir/requirements.txt"
      fi
    done
  '';

  processes = {
    vite.exec = ''
      exec npm run dev -- --port 5173 --strictPort
    '';
    stt-server.exec = ''
      export LD_PRELOAD=/nix/store/si4q3zks5mn5jhzzyri9hhd3cv789vlm-gcc-15.2.0-lib/lib/libstdc++.so.6
      exec src/stt/.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8765 --app-dir src/stt
    '';
    tts-server.exec = ''
      export LD_PRELOAD=/nix/store/si4q3zks5mn5jhzzyri9hhd3cv789vlm-gcc-15.2.0-lib/lib/libstdc++.so.6
      exec src/tts/.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8766 --app-dir src/tts
    '';
  };
}