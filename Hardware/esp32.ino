#include <Wire.h>

// ================= MPU6050 =================
#define MPU_ADDR 0x68
int16_t ax, ay, az;
float accX, accY, accZ;
float velocity = 0;
unsigned long prevTime;
bool fallDetected = false;

// ================= AQI =================
#define MQ135_PIN 34
#define MQ7_PIN   35

// ================= PI UART =================
#define PI_TX 25   // ESP32 → Raspberry Pi
HardwareSerial piSerial(1);

// ================= SIMULATED GPS =================
float gps_lat = 13.171800;
float gps_lon = 77.536200;
int satellites = 8;
float altitude = 900.0;

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  // Raspberry Pi UART
  piSerial.begin(9600, SERIAL_8N1, -1, PI_TX);

  // MPU
  Wire.begin(21, 22);
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);

  prevTime = millis();

  Serial.println("SMART HELMET SYSTEM (WITH PI OUTPUT) READY 🚀");
}

// ================= LOOP =================
void loop() {
  readMPU();
  calculateSpeed();
  detectFall();

  int aqi = readAQI();

  sendData(aqi);

  delay(1000);
}

// ================= MPU READ =================
void readMPU() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);

  ax = Wire.read() << 8 | Wire.read();
  ay = Wire.read() << 8 | Wire.read();
  az = Wire.read() << 8 | Wire.read();

  accX = ax / 16384.0;
  accY = ay / 16384.0;
  accZ = az / 16384.0;
}

// ================= SPEED =================
void calculateSpeed() {
  unsigned long currentTime = millis();
  float dt = (currentTime - prevTime) / 1000.0;
  prevTime = currentTime;

  float accTotal = sqrt(accX*accX + accY*accY + accZ*accZ) - 1.0;
  if (accTotal < 0) accTotal = 0;

  velocity += accTotal * 9.81 * dt;
  velocity *= 0.98;
}

// ================= FALL =================
void detectFall() {
  float accTotal = sqrt(accX*accX + accY*accY + accZ*accZ);

  if (accTotal > 2.5) {
    fallDetected = true;
  } else {
    fallDetected = false;
  }
}

// ================= AQI =================
int readAQI() {
  int mq135 = analogRead(MQ135_PIN);
  int mq7   = analogRead(MQ7_PIN);

  float avg = (mq135 * 0.6) + (mq7 * 0.4);

  return map(avg, 0, 4095, 0, 500);
}

// ================= AQI LEVEL =================
String getAQILevel(int aqi) {
  if (aqi <= 50) return "GOOD";
  else if (aqi <= 100) return "MODERATE";
  else if (aqi <= 200) return "UNHEALTHY";
  else if (aqi <= 300) return "POOR";
  else return "HAZARDOUS";
}

// ================= SEND DATA =================
void sendData(int aqi) {
  String data = "";

  data += "LAT=" + String(gps_lat, 6);
  data += ",LON=" + String(gps_lon, 6);
  data += ",SAT=" + String(satellites);
  data += ",ALT=" + String(altitude);

  data += ",SPD=" + String(velocity, 2);

  data += ",ACC=" + String(accX,2) + "," + String(accY,2) + "," + String(accZ,2);

  data += ",AQI=" + String(aqi);
  data += "(" + getAQILevel(aqi) + ")";

  if (fallDetected) {
    data += ",FALL=YES";
  } else {
    data += ",FALL=NO";
  }

  // Print to Serial Monitor
  Serial.println(data);

  // Send to Raspberry Pi
  piSerial.println(data);
}