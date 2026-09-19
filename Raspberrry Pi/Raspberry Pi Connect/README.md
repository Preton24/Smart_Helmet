# Init
```
sudo apt update
```
```
sudo apt full-upgrade -y
```
Full upgrade not important tho

# Install Raspberry Pi Connect
```
sudo apt install rpi-connect
```

# Enable Raspberry Pi Connect service
```
rpi-connect on
rpi-connect status
```

# Sign in and link your Pi to your account
```
rpi-connect signin
```

# Make sure Desktop is enabled (important)
```
echo $XDG_SESSION_TYPE
```
If nothing shows up, ask ChatGPT

___
