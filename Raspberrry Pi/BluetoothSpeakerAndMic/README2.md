# Making it persistent

```
mkdir -p ~/.config/wireplumber/main.lua.d
vi ~/.config/wireplumber/main.lua.d/51-bluetooth-headset.lua
```

Paste the below thing
```
rule = {
  matches = {
    {
      { "device.name", "equals", "bluez_card.17_F1_D8_16_15_40" },
    },
  },
  apply_properties = {
    ["bluez5.profile"] = "headset-head-unit",
  },
}

table.insert(alsa_monitor.rules, rule)
```

## Restart audio stack

```
systemctl --user restart wireplumber
systemctl --user restart pipewire
```

___
___
___

# Auto-set Bluetooth as default input

```
vi ~/.config/wireplumber/main.lua.d/52-bluetooth-defaults.lua
```

Paste the below thing
```
rule = {
  matches = {
    {
      { "node.name", "equals", "bluez_input.17:F1:D8:16:15:40" },
    },
  },
  apply_properties = {
    ["priority.session"] = 2000,
  },
}

table.insert(alsa_monitor.rules, rule)
```

## Restart
```
systemctl --user restart wireplumber
```


## Verify
```
pactl info | grep "Default Source"
```
Expected: ```Default Source: bluez_input.17:F1:D8:16:15:40```

___
___
___

# Survives reboot or not

```
sudo reboot
```
```
pactl list cards | grep "Active Profile"
pactl info | grep "Default Source"
```