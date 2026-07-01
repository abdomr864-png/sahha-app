import SwiftUI

/// Entry point for the Sahha Apple Watch companion. Owns the two managers
/// (WatchConnectivity + HealthKit workout) and routes between the start screen
/// and the active-workout glance based on the phone's snapshot.
@main
struct SahhaWatchApp: App {
  @StateObject private var connectivity = WatchConnectivityManager.shared
  @StateObject private var workout = WorkoutManager()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(connectivity)
        .environmentObject(workout)
        .onAppear {
          connectivity.activate()
          workout.requestAuthorization { _ in }
        }
    }
  }
}

struct RootView: View {
  @EnvironmentObject var connectivity: WatchConnectivityManager
  @EnvironmentObject var workout: WorkoutManager

  var body: some View {
    NavigationStack {
      if connectivity.snapshot.active {
        ActiveWorkoutView()
      } else {
        StartView()
      }
    }
    // If the phone ends the workout, make sure the wrist session ends too.
    .onChange(of: connectivity.snapshot.active) { _, active in
      if !active && workout.running {
        workout.end()
      }
    }
  }
}
