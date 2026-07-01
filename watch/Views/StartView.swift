import SwiftUI

/// Shown when there's no active workout. Big single tap target to start one from
/// the wrist (mirrors the phone's "start workout"). The phone creates the draft
/// and echoes it back as a snapshot, which flips us into ActiveWorkoutView.
struct StartView: View {
  @EnvironmentObject var connectivity: WatchConnectivityManager
  @EnvironmentObject var workout: WorkoutManager

  var body: some View {
    VStack(spacing: 12) {
      Image(systemName: "dumbbell.fill")
        .font(.system(size: 34))
        .foregroundStyle(.orange)

      Text("Sahha")
        .font(.title3.bold())

      Text(connectivity.reachable ? "Ready" : "Open Sahha on iPhone")
        .font(.footnote)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)

      Button {
        connectivity.send(Outbound.startWorkout(name: nil))
        workout.start()
      } label: {
        Label("Start Workout", systemImage: "play.fill")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.borderedProminent)
      .tint(.orange)
    }
    .padding(.horizontal)
  }
}
