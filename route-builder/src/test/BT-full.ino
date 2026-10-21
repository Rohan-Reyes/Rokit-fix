#include "Zumi.h"
int targetHeading, gapMs, headingError, startTime, straightTime, straightSpeed, errorSum, correction, steerStrength, acrossBlocks, acrossSpeed, blocksSeen, onWhite, BL, BR, traceCs, spdStraight, spdFast, spdSlow, spdPivot, lostSpd, S_BL, S_BR, prev, currrent, lastTurn = 0;

float secPerBlock = 1;

void setup() {
  Zumi.IRsensorInit();
  Zumi.startIRreceiver();
  Zumi.setIRChannel(1);
  Zumi.MotorInit();
  Zumi.DCMotor(M1, STOP, 0);
  Zumi.DCMotor(M2, STOP, 0);
  Zumi.GyroCalibration();

  straightSpeed = 160;
  secPerBlock = 1;
  acrossSpeed = 200;
  steerStrength = 8;
  traceCs = 810;
  BL = 100;
  BR = 100;
  spdStraight = 150;
  spdFast = 175;
  spdSlow = 110;
  spdPivot = 110;
  lostSpd = 30;
  gapMs = 650;
  Zumi.delayForGyro(0.5);
  targetHeading = round(  Zumi.eulerAngle(YAW));
  acrossBlocks = 5;
 across();
  straightTime = (gapMs / 10);
 straight();
  targetHeading += 90;
 turn();
  acrossBlocks = 5;
 across();
  straightTime = (gapMs / 10);
 straight();
  targetHeading += 90;
 turn();
  acrossBlocks = 2;
 across();
  straightTime = (gapMs / 10);
 straight();
  targetHeading += 90;
 turn();
  straightTime = (1 * (secPerBlock * 100));
 back();
  Zumi.delayForGyro(2);
  straightTime = (1 * (secPerBlock * 100));
 straight();
  targetHeading += -90;
 turn();
  acrossBlocks = 2;
 across();
  straightTime = (0.5 * (secPerBlock * 100));
 straight();
  targetHeading += -90;
 turn();
  straightTime = (1 * (secPerBlock * 100));
 back();
  Zumi.delayForGyro(2);
  acrossBlocks = 5;
 across();
  straightTime = (gapMs / 10);
 straight();
  targetHeading += -90;
 turn();
  acrossBlocks = 4;
 across();
  straightTime = (0.5 * (secPerBlock * 100));
 straight();
 lineTrace();
  Zumi.DCMotor(M1, STOP, 0);
  Zumi.DCMotor(M2, STOP, 0);
}

void loop() {}
void turn() {
  if ((targetHeading > 180)) {    targetHeading += -360;}
  if ((targetHeading < -180)) {    targetHeading += 360;}
  headingError = 999;
  while(!(Zumi.math(ABS,headingError) < 20)){    headingError = ((targetHeading -   Zumi.eulerAngle(YAW)) * 10);
  if ((headingError > 1800)) {    headingError += -3600;}
  if ((headingError < -1800)) {    headingError += 3600;}
  if ((headingError > 0)) {    Zumi.DCMotor(M1, CCW, (55 + (Zumi.math(ABS,headingError) * 0.1)));
  Zumi.DCMotor(M2, CCW, (55 + (Zumi.math(ABS,headingError) * 0.1)));} else {    Zumi.DCMotor(M1, CW, (55 + (Zumi.math(ABS,headingError) * 0.1)));
  Zumi.DCMotor(M2, CW, (55 + (Zumi.math(ABS,headingError) * 0.1)));}  }
  Zumi.DCMotor(M1, STOP, 0);
  Zumi.DCMotor(M2, STOP, 0);
}

void straight() {
  startTime = (  millis() / 10);
  while(!(((  millis() / 10) - startTime) > straightTime)){    headingError = ((targetHeading -   Zumi.eulerAngle(YAW)) * 10);
  if ((headingError > 1800)) {    headingError += -3600;}
  if ((headingError < -1800)) {    headingError += 3600;}
  errorSum += headingError;
  if ((errorSum > 5000)) {    errorSum = 5000;}
  if ((errorSum < -5000)) {    errorSum = -5000;}
  correction = ((headingError * (steerStrength * 0.1)) + (errorSum * 0.002));
  if ((correction > 50)) {    correction = 50;}
  if ((correction < -50)) {    correction = -50;}
  Zumi.DCMotor(M1, CCW, (straightSpeed + correction));
  Zumi.DCMotor(M2, CW, (straightSpeed - correction));  }
  Zumi.DCMotor(M1, STOP, 0);
  Zumi.DCMotor(M2, STOP, 0);
}

void back() {
  startTime = (  millis() / 10);
  while(!(((  millis() / 10) - startTime) > straightTime)){    headingError = ((targetHeading -   Zumi.eulerAngle(YAW)) * 10);
  if ((headingError > 1800)) {    headingError += -3600;}
  if ((headingError < -1800)) {    headingError += 3600;}
  correction = (headingError * (steerStrength * 0.1));
  if ((correction > 50)) {    correction = 50;}
  if ((correction < -50)) {    correction = -50;}
  Zumi.DCMotor(M1, CW, (straightSpeed - correction));
  Zumi.DCMotor(M2, CCW, (straightSpeed + correction));  }
  Zumi.DCMotor(M1, STOP, 0);
  Zumi.DCMotor(M2, STOP, 0);
}

void across() {
  blocksSeen = 0;
  onWhite = 0;
  while(!!((blocksSeen < acrossBlocks))){    headingError = ((targetHeading -   Zumi.eulerAngle(YAW)) * 10);
  if ((headingError > 1800)) {    headingError += -3600;}
  if ((headingError < -1800)) {    headingError += 3600;}
  errorSum += headingError;
  if ((errorSum > 5000)) {    errorSum = 5000;}
  if ((errorSum < -5000)) {    errorSum = -5000;}
  correction = ((headingError * (steerStrength * 0.1)) + (errorSum * 0.002));
  if ((correction > 50)) {    correction = 50;}
  if ((correction < -50)) {    correction = -50;}
  Zumi.DCMotor(M1, CCW, (acrossSpeed + correction));
  Zumi.DCMotor(M2, CW, (acrossSpeed - correction));
  if ((onWhite == 0)) {    if (((  Zumi.readIR(THE_BOTTOM_LEFT, 1) < BL) || (  Zumi.readIR(THE_BOTTOM_RIGHT, 1) < BR))) {    onWhite = 1;
  blocksSeen += 1;}} else {    if (((  Zumi.readIR(THE_BOTTOM_LEFT, 1) > (BL + 30)) && (  Zumi.readIR(THE_BOTTOM_RIGHT, 1) > (BR + 30)))) {    onWhite = 0;}}  }
  Zumi.DCMotor(M1, STOP, 0);
  Zumi.DCMotor(M2, STOP, 0);
}

void lineTrace() {
  lastTurn = 0;
  S_BL =   Zumi.readIR(THE_BOTTOM_LEFT, 1);
  S_BR =   Zumi.readIR(THE_BOTTOM_RIGHT, 1);
  currrent = (  millis() / 10);
  prev = (  millis() / 10);
  while(!(((S_BL > BL) || (S_BR > BR)) || ((currrent - prev) > 300))){    currrent = (  millis() / 10);
  S_BL =   Zumi.readIR(THE_BOTTOM_LEFT, 1);
  S_BR =   Zumi.readIR(THE_BOTTOM_RIGHT, 1);
  Zumi.DCMotor(M1, CCW, spdSlow);
  Zumi.DCMotor(M2, CW, spdSlow);  }
  if (((S_BL < BL) && (S_BR > BR))) {    lastTurn = 1;}
  if (((S_BL > BL) && (S_BR < BR))) {    lastTurn = 2;}
  prev = (  millis() / 10);
  while(!((currrent - prev) > traceCs)){    currrent = (  millis() / 10);
  S_BR =   Zumi.readIR(THE_BOTTOM_RIGHT, 1);
  S_BL =   Zumi.readIR(THE_BOTTOM_LEFT, 1);
  if (((S_BL > BL) && (S_BR > BR))) {    lastTurn = 0;
  Zumi.DCMotor(M1, CCW, spdStraight);
  Zumi.DCMotor(M2, CW, spdStraight);} else {    if (((S_BL < BL) && (S_BR > BR))) {    lastTurn = 1;
  Zumi.DCMotor(M1, CCW, spdFast);
  Zumi.DCMotor(M2, CW, spdSlow);} else {    if (((S_BL > BL) && (S_BR < BR))) {    lastTurn = 2;
  Zumi.DCMotor(M1, CCW, spdSlow);
  Zumi.DCMotor(M2, CW, spdFast);} else {    if ((lastTurn == 1)) {    Zumi.DCMotor(M1, CCW, spdPivot);
  Zumi.DCMotor(M2, STOP, 0);} else {    if ((lastTurn == 2)) {    Zumi.DCMotor(M1, STOP, 0);
  Zumi.DCMotor(M2, CW, spdPivot);} else {    Zumi.DCMotor(M1, CCW, lostSpd);
  Zumi.DCMotor(M2, CW, lostSpd);}}}}}  }
  Zumi.DCMotor(M1, STOP, 0);
  Zumi.DCMotor(M2, STOP, 0);
}

