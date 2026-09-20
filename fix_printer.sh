#!/bin/bash
# Run this ONCE to permanently fix the usblp conflict
echo "Fixing XPrinter usblp conflict..."

# Remove usblp RIGHT NOW
sudo modprobe -r usblp 2>/dev/null && echo "✓ usblp removed" || echo "usblp already unloaded"

# Blacklist it permanently (survives reboot)
echo "blacklist usblp" | sudo tee /etc/modprobe.d/blacklist-usblp.conf
sudo update-initramfs -u 2>/dev/null || true
echo "✓ usblp blacklisted permanently"

# Test print
echo ""
echo "Testing print..."
python3 shopshield_print.py --test
