# Multiple Networks

```
nmcli connection show
```

```
sudo nmcli connection add type wifi ifname wlan0 con-name saiDhyanHotspot ssid "Sai dhyan"
sudo nmcli connection modify saiDhyanHotspot wifi-sec.key-mgmt wpa-psk
sudo nmcli connection modify saiDhyanHotspot wifi-sec.psk "lymo2081"

```

```
sudo nmcli connection add type wifi ifname wlan0 con-name mohithHotspot ssid "Mohith"
sudo nmcli connection modify mohithHotspot wifi-sec.key-mgmt wpa-psk
sudo nmcli connection modify mohithHotspot wifi-sec.psk "devilisback"
```

```
sudo nmcli connection modify "netplan-wlan0-NothingPhone1" connection.autoconnect-priority 30
sudo nmcli connection modify saiDhyanHotspot connection.autoconnect-priority 20
sudo nmcli connection modify mohithHotspot connection.autoconnect-priority 10
```

```
nmcli connection show
```