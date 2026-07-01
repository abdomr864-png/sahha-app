import Foundation

// Swift mirror of the wire contract in features/watch/messages.ts. Keep the two
// in sync — `protocolVersion` must match PROTOCOL_VERSION on the phone.

let protocolVersion = 1

// MARK: - Phone → Watch snapshot (decoded from the WCSession application context)

struct WatchSetView: Codable, Identifiable, Hashable {
  let id: String
  let index: Int
  let reps: Int
  let weightKg: Double
  let completed: Bool
  let isWarmup: Bool
}

struct WatchExerciseView: Codable, Identifiable, Hashable {
  let id: String
  let name: String
  let targetReps: Int?
  let restSeconds: Int?
  let sets: [WatchSetView]
}

struct WatchWorkoutSnapshot: Codable, Hashable {
  let v: Int
  let active: Bool
  let paused: Bool
  let workoutId: String?
  let name: String?
  let startedAt: String?
  let currentExerciseId: String?
  let currentSetId: String?
  let exercises: [WatchExerciseView]
  let updatedAt: String

  static let empty = WatchWorkoutSnapshot(
    v: protocolVersion, active: false, paused: false, workoutId: nil, name: nil,
    startedAt: nil, currentExerciseId: nil, currentSetId: nil, exercises: [], updatedAt: ""
  )

  /// Decode from the JSON string the phone packs into the application context.
  static func decode(_ json: String) -> WatchWorkoutSnapshot? {
    guard let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WatchWorkoutSnapshot.self, from: data)
  }

  /// The exercise the glance should foreground.
  var currentExercise: WatchExerciseView? {
    exercises.first { $0.id == currentExerciseId } ?? exercises.first
  }

  /// The set the glance should foreground.
  var currentSet: WatchSetView? {
    guard let ex = currentExercise else { return nil }
    return ex.sets.first { $0.id == currentSetId } ?? ex.sets.first { !$0.completed } ?? ex.sets.last
  }
}

// MARK: - Watch → Phone messages (built as dictionaries, sent as JSON strings)

enum Outbound {
  private static func now() -> String {
    ISO8601DateFormatter().string(from: Date())
  }

  private static func base(_ type: String) -> [String: Any] {
    ["type": type, "messageId": UUID().uuidString, "at": now()]
  }

  static func startWorkout(name: String?) -> [String: Any] {
    var m = base("startWorkout")
    m["name"] = name.map { $0 as Any } ?? NSNull()
    return m
  }

  static func finishWorkout() -> [String: Any] {
    base("finishWorkout")
  }

  static func setPaused(_ paused: Bool) -> [String: Any] {
    var m = base("setPaused")
    m["paused"] = paused
    return m
  }

  static func addSet(workoutExerciseId: String, setId: String) -> [String: Any] {
    var m = base("addSet")
    m["workoutExerciseId"] = workoutExerciseId
    m["setId"] = setId
    return m
  }

  static func completeSet(
    workoutExerciseId: String, setId: String, reps: Int, weightKg: Double
  ) -> [String: Any] {
    var m = base("completeSet")
    m["workoutExerciseId"] = workoutExerciseId
    m["setId"] = setId
    m["reps"] = reps
    m["weightKg"] = weightKg
    return m
  }

  static func updateSet(
    workoutExerciseId: String, setId: String, reps: Int?, weightKg: Double?
  ) -> [String: Any] {
    var m = base("updateSet")
    m["workoutExerciseId"] = workoutExerciseId
    m["setId"] = setId
    m["reps"] = reps.map { $0 as Any } ?? NSNull()
    m["weightKg"] = weightKg.map { $0 as Any } ?? NSNull()
    return m
  }
}
