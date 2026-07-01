import Foundation
import HealthKit
import WatchKit

/// Drives the on-wrist HealthKit workout session so heart rate streams live and
/// the session shows in the green-ring Activity app and counts toward the rings.
/// Also owns the rest timer + haptics. UI-facing state is @Published.
final class WorkoutManager: NSObject, ObservableObject {
  @Published var heartRate: Double = 0
  @Published var elapsed: TimeInterval = 0
  @Published var running = false
  @Published var authorized = false

  /// Seconds remaining on the current rest timer (0 when idle).
  @Published var restRemaining: Int = 0

  private let healthStore = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?

  private var tickTimer: Timer?
  private var restTimer: Timer?

  // MARK: - Authorization

  func requestAuthorization(completion: @escaping (Bool) -> Void) {
    guard HKHealthStore.isHealthDataAvailable() else {
      completion(false)
      return
    }
    let share: Set = [HKObjectType.workoutType()]
    let read: Set = [
      HKObjectType.quantityType(forIdentifier: .heartRate)!,
      HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
      HKObjectType.workoutType(),
    ]
    healthStore.requestAuthorization(toShare: share, read: read) { [weak self] ok, _ in
      DispatchQueue.main.async {
        self?.authorized = ok
        completion(ok)
      }
    }
  }

  // MARK: - Session lifecycle

  func start() {
    guard session == nil else { return }
    let config = HKWorkoutConfiguration()
    config.activityType = .traditionalStrengthTraining
    config.locationType = .indoor

    do {
      let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
      let builder = session.associatedWorkoutBuilder()
      builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)
      session.delegate = self
      builder.delegate = self

      let startDate = Date()
      session.startActivity(with: startDate)
      builder.beginCollection(withStart: startDate) { _, _ in }

      self.session = session
      self.builder = builder
      self.running = true
      startTick(from: startDate)
    } catch {
      NSLog("[WorkoutManager] failed to start: \(error.localizedDescription)")
    }
  }

  func pause() {
    session?.pause()
    running = false
    tickTimer?.invalidate()
  }

  func resume() {
    session?.resume()
    running = true
    if let start = builder?.startDate { startTick(from: start) }
  }

  func end() {
    tickTimer?.invalidate()
    restTimer?.invalidate()
    restRemaining = 0
    running = false
    session?.end()
    builder?.endCollection(withEnd: Date()) { [weak self] _, _ in
      self?.builder?.finishWorkout { _, _ in }
      self?.session = nil
      self?.builder = nil
    }
  }

  // MARK: - Elapsed tick

  private func startTick(from start: Date) {
    tickTimer?.invalidate()
    tickTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      self?.elapsed = Date().timeIntervalSince(start)
    }
  }

  // MARK: - Rest timer + haptics

  /// Start a rest countdown; fire a notification haptic when it completes.
  func startRest(seconds: Int) {
    restTimer?.invalidate()
    guard seconds > 0 else { return }
    restRemaining = seconds
    WKInterfaceDevice.current().play(.start)
    restTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] timer in
      guard let self = self else { return }
      self.restRemaining -= 1
      if self.restRemaining <= 0 {
        timer.invalidate()
        self.restRemaining = 0
        WKInterfaceDevice.current().play(.notification) // rest complete
      }
    }
  }

  /// Haptic confirming a set was logged.
  func confirmHaptic() {
    WKInterfaceDevice.current().play(.success)
  }
}

extension WorkoutManager: HKWorkoutSessionDelegate {
  func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState,
    date: Date
  ) {
    DispatchQueue.main.async { self.running = (toState == .running) }
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
    NSLog("[WorkoutManager] session error: \(error.localizedDescription)")
  }
}

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
  func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

  func workoutBuilder(
    _ workoutBuilder: HKLiveWorkoutBuilder,
    didCollectDataOf collectedTypes: Set<HKSampleType>
  ) {
    guard
      let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate),
      collectedTypes.contains(hrType),
      let stats = workoutBuilder.statistics(for: hrType),
      let value = stats.mostRecentQuantity()?.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
    else { return }
    DispatchQueue.main.async { self.heartRate = value }
  }
}
