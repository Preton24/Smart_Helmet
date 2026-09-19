# Check if earphones are connected
```
bluetoothctl
```
```
devices
Device XX:XX:XX:XX:XX:XX Your_Earphones_Name
connect XX:XX:XX:XX:XX:XX
exit
```

# Install required packages
```
sudo apt update
sudo apt install -y pulseaudio pulseaudio-module-bluetooth bluez
```

### Enable PulseAudio for user sessions
```
systemctl --user enable pulseaudio
systemctl --user start pulseaudio
```
```
sudo reboot
```

# Switch to headset mode
```
pactl set-card-profile bluez_card.17_F1_D8_16_15_40 headset-head-unit
```

# Select bluetooth mic as default input
```
pactl list short sources
```
You'll see something like: ```bluez_input.XX_XX_XX_XX_XX_XX```

```
pactl set-default-source bluez_input.17:F1:D8:16:15:40
pactl set-default-sink bluez_output.17_F1_D8_16_15_40.1
```

# Test
```
arecord -D pulse -f cd test.wav
```
```
aplay test.wav

```