import SwiftUI

/// The active-workout glance: heart rate + elapsed time up top, the current
/// exercise / set / target in the middle, and large controls. Everything is
/// driven by the phone's snapshot so the two stay in lockstep.
struct ActiveWorkoutView: View {
  @EnvironmentObject var connectivity: WatchConnectivityManager
  @EnvironmentObject var workout: WorkoutManager

  private var snapshot: WatchWorkoutSnapshot { connectivity.snapshot }

  var body: some View {
    ScrollView {
      VStack(spacing: 10) {
        metrics

        if workout.restRemaining > 0 {
          restPill
        }

        currentSetCard

        if let ex = snapshot.currentExercise, let set = snapshot.currentSet {
          NavigationLink {
            SetLoggerView(exercise: ex, set: set)
          } label: {
            Label("Log Set", systemImage: "checkmark.circle.fill")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.borderedProminent)
          .tint(.green)
        }

        controls
      }
      .padding(.horizontal, 4)
    }
    .navigationTitle(snapshot.name ?? "Workout")
    .navigationBarTitleDisplayMode(.inline)
  }

  private var metrics: some View {
    HStack {
      VStack(alignment: .leading, spacing: 2) {
        Label("\(Int(workout.heartRate))", systemImage: "heart.fill")
          .foregroundStyle(.red)
          .font(.title3.bold())
        Text("BPM").font(.system(size: 9)).foregroundStyle(.secondary)
      }
      Spacer()
      VStack(alignment: .trailing, spacing: 2) {
        Text(elapsedString).font(.title3.bold()).monospacedDigit()
        Text("TIME").font(.system(size: 9)).foregroundStyle(.secondary)
      }
    }
    .padding(.horizontal, 6)
  }

  private var restPill: some View {
    Label("Rest \(workout.restRemaining)s", systemImage: "timer")
      .font(.footnote.bold())
      .foregroundStyle(.orange)
      .frame(maxWidth: .infinity)
      .padding(.vertical, 4)
      .background(Color.orange.opacity(0.15), in: Capsule())
  }

  private var currentSetCard: some View {
    VStack(spacing: 4) {
      if let ex = snapshot.currentExercise {
        Text(ex.name)
          .font(.headline)
          .multilineTextAlignment(.center)
          .lineLimit(2)
        if let set = snapshot.currentSet {
          Text("Set \(set.index)")
            .font(.footnote)
            .foregroundStyle(.secondary)
          Text(targetLabel(ex: ex, set: set))
            .font(.title3.bold())
            .foregroundStyle(.orange)
        }
      } else {
        Text("No exercises yet").font(.footnote).foregroundStyle(.secondary)
      }
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 8)
    .background(Color.gray.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
  }

  private var controls: some View {
    HStack(spacing: 8) {
      Button {
        let paused = !snapshot.paused
        connectivity.send(Outbound.setPaused(paused))
        if paused { workout.pause() } else { workout.resume() }
      } label: {
        Image(systemName: snapshot.paused ? "play.fill" : "pause.fill")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.bordered)

      Button(role: .destructive) {
        connectivity.send(Outbound.finishWorkout())
        workout.end()
      } label: {
        Image(systemName: "stop.fill")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.bordered)
      .tint(.red)
    }
  }

  private func targetLabel(ex: WatchExerciseView, set: WatchSetView) -> String {
    let reps = ex.targetReps ?? set.reps
    let weight = set.weightKg
    if weight > 0 {
      return "\(formatWeight(weight)) kg × \(reps)"
    }
    return "\(reps) reps"
  }

  private var elapsedString: String {
    let total = Int(workout.elapsed)
    return String(format: "%d:%02d", total / 60, total % 60)
  }
}

func formatWeight(_ kg: Double) -> String {
  kg.rounded() == kg ? String(Int(kg)) : String(format: "%.1f", kg)
}
