#!/bin/bash
# MangoGuard Auto-Start Installer
# Run this once on the Pi: bash install_service.sh

echo "=== MangoGuard Service Installer ==="

# Copy service file to systemd
sudo cp mangoguard.service /etc/systemd/system/mangoguard.service

# Reload systemd, enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable mangoguard.service
sudo systemctl start mangoguard.service

echo ""
echo "=== Done! MangoGuard will now auto-start on every boot ==="
echo ""
echo "Useful commands:"
echo "  sudo systemctl status mangoguard   # Check if running"
echo "  sudo journalctl -u mangoguard -f   # Live logs"
echo "  sudo systemctl stop mangoguard     # Stop the service"
echo "  sudo systemctl restart mangoguard  # Restart it"
