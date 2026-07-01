import SwiftUI

/// One-tap set logging with Digital Crown adjustment of reps and weight. Opens
/// pre-filled from the current set's values, so the common path is: glance →
/// tap "Log Set" → tap the green check. Crown nudges reps/weight when needed.
struct SetLoggerView: View {
  @EnvironmentObject var connectivity: WatchConnectivityManager
  @EnvironmentObject var workout: WorkoutManager
  @Environment(\.dismiss) private var dismiss

  let exercise: WatchExerciseView
  let set: WatchSetView

  @State private var reps: Double
  @State private var weight: Double

  init(exercise: WatchExerciseView, set: WatchSetView) {
    self.exercise = exercise
    self.set = set
    // Pre-fill from the set, falling back to the exercise target for reps.
    _reps = State(initialValue: Double(set.reps > 0 ? set.reps : (exercise.targetReps ?? 8)))
    _weight = State(initialValue: set.weightKg)
  }

  var body: some View {
    VStack(spacing: 8) {
      Text(exercise.name)
        .font(.headline)
        .lineLimit(1)

      HStack(spacing: 10) {
        crownField(title: "REPS", value: repsText, accent: .orange,
                   binding: $reps, range: 0...50, step: 1)
        crownField(title: "KG", value: formatWeight(weight), accent: .blue,
                   binding: $weight, range: 0...500, step: 2.5)
      }

      Button {
        logSet()
      } label: {
        Label("Log Set \(set.index)", systemImage: "checkmark")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.borderedProminent)
      .tint(.green)
    }
    .padding(.horizontal, 6)
    .navigationTitle("Set \(set.index)")
    .navigationBarTitleDisplayMode(.inline)
  }

  private var repsText: String { String(Int(reps)) }

  private func crownField(
    title: String, value: String, accent: Color,
    binding: Binding<Double>, range: ClosedRange<Double>, step: Double
  ) -> some View {
    VStack(spacing: 2) {
      Text(title).font(.system(size: 9)).foregroundStyle(.secondary)
      Text(value).font(.title2.bold()).foregroundStyle(accent).monospacedDigit()
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 10)
    .background(accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
    .focusable()
    .digitalCrownRotation(binding, from: range.lowerBound, through: range.upperBound,
                          by: step, sensitivity: .low, isContinuous: false)
  }

  private func logSet() {
    connectivity.send(
      Outbound.completeSet(
        workoutExerciseId: exercise.id,
        setId: set.id,
        reps: Int(reps),
        weightKg: weight
      )
    )
    workout.confirmHaptic()
    if let rest = exercise.restSeconds, rest > 0 {
      workout.startRest(seconds: rest)
    }
    dismiss()
  }
}
