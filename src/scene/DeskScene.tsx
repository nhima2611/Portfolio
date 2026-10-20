import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { COLORS, LIGHTS } from './config';
import { HoverDriver } from './hover';
import { BiasLights } from './objects/BiasLights';
import { Bookshelf } from './objects/Bookshelf';
import { Chair } from './objects/Chair';
import { Cat, Duck } from './objects/Critters';
import { Dust } from './objects/Dust';
import { FlightFX } from './objects/FlightFX';
import { Lamp } from './objects/Lamp';
import { Laptop } from './objects/Laptop';
import { ModelJet } from './objects/ModelJet';
import { Monitor } from './objects/Monitor';
import { Mug } from './objects/Mug';
import { DeskKeyboard, Headphones, Mouse } from './objects/Peripherals';
import { Phone } from './objects/Phone';
import { Room } from './objects/Room';
import { Poster, StickyNotes, WallClock } from './objects/WallDecor';
import { CityWindow } from './objects/Window';
import { introElapsed, introPower } from './state';

function ScreenGlow() {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (ref.current) ref.current.intensity = LIGHTS.screenGlow * introPower(introElapsed()).monitor;
  });
  return <pointLight ref={ref} position={[0.15, 1.05, 0.05]} color={COLORS.screen} intensity={0} distance={1.6} decay={2} />;
}

export function DeskScene() {
  return (
    <>
      <color attach="background" args={[COLORS.room]} />
      <fog attach="fog" args={[COLORS.room, 4, 9]} />
      <hemisphereLight args={['#6f86b8', '#1a1410', LIGHTS.hemisphere]} />
      <directionalLight position={[3, 3, 3]} color="#5a6c9a" intensity={LIGHTS.fill} />
      <ScreenGlow />

      <Room />
      <Lamp />
      <Dust />
      <Monitor />
      <Laptop />
      <Phone />
      <Mug />
      <Bookshelf />
      <ModelJet />
      <FlightFX />

      <CityWindow />
      <WallClock />
      <Poster />
      <BiasLights />
      <StickyNotes />
      <DeskKeyboard />
      <Mouse />
      <Headphones />
      <Duck />
      <Cat />
      <Chair />

      <HoverDriver />
      <CameraRig />
    </>
  );
}
