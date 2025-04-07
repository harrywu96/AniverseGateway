#!/bin/bash
echo "Installing SubTranslate with UV..."

ARGS=""

# Parse arguments
for arg in "$@"; do
    if [ "$arg" == "--dev" ] || [ "$arg" == "--recreate-venv" ]; then
        ARGS="$ARGS $arg"
    fi
done

# Run the installation script
python uv_install.py $ARGS

if [ $? -ne 0 ]; then
    echo "Installation failed with error code $?"
    exit 1
fi

echo
echo "Installation completed successfully!"
echo "You can activate the environment with: source ./scripts/activate.sh"
echo 