/**
 * Local Expo module: the iOS-side WatchConnectivity bridge.
 *
 * The typed wrapper that the app actually uses lives in
 * features/watch/bridge.ts (it adds the JSON contract, validation, and a no-op
 * fallback for platforms without the native module). This file only re-exports
 * the raw native module for anyone who needs direct access.
 *
 * Implementation: modules/watch-bridge/ios/WatchBridgeModule.swift
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

export default requireOptionalNativeModule('WatchBridge');
