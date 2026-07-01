import Foundation
import WatchConnectivity

/// Watch-side WatchConnectivity. Receives the active-workout snapshot from the
/// phone (application context, latest-state-wins) and sends action messages
/// back. When the phone isn't reachable it uses `transferUserInfo` — guaranteed,
/// FIFO delivery on reconnect — so a set logged in a tunnel is never lost. The
/// phone's reconcile is idempotent, so the queued replay can't double-log.
final class WatchConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {
  static let shared = WatchConnectivityManager()

  @Published var snapshot: WatchWorkoutSnapshot = .empty
  @Published var reachable: Bool = false

  private var session: WCSession { WCSession.default }

  func activate() {
    guard WCSession.isSupported() else { return }
    session.delegate = self
    session.activate()
  }

  /// Send an action to the phone. Live when reachable, queued otherwise. The
  /// caller builds the dict once (with a stable messageId) so retries are safe.
  func send(_ dict: [String: Any]) {
    guard
      let data = try? JSONSerialization.data(withJSONObject: dict),
      let json = String(data: data, encoding: .utf8)
    else { return }
    let payload = ["json": json]

    if session.activationState == .activated && session.isReachable {
      session.sendMessage(
        payload,
        replyHandler: nil,
        errorHandler: { [weak self] _ in
          // Live send failed mid-flight — fall back to guaranteed delivery.
          self?.session.transferUserInfo(payload)
        }
      )
    } else {
      session.transferUserInfo(payload)
    }
  }

  // MARK: - WCSessionDelegate

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    DispatchQueue.main.async { self.reachable = session.isReachable }
    apply(session.receivedApplicationContext)
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    DispatchQueue.main.async { self.reachable = session.isReachable }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    apply(applicationContext)
  }

  /// Acks arrive here. We don't need to act on them (state is reconciled via the
  /// snapshot), but we keep the handler so the message isn't dropped silently.
  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    // no-op: acks are advisory; the next snapshot is the source of truth.
  }

  private func apply(_ context: [String: Any]) {
    guard
      let json = context["json"] as? String,
      let snap = WatchWorkoutSnapshot.decode(json),
      snap.v == protocolVersion
    else { return }
    DispatchQueue.main.async { self.snapshot = snap }
  }
}
