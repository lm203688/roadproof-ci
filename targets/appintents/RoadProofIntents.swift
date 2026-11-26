import AppIntents
import Foundation

// The intent reads the same App Group snapshot the app writes, so Siri can never
// disagree with the screen. No duplicate maths lives here on purpose.
private func snapshot() -> [String: Any]? {
  let group = "group." + (Bundle.main.bundleIdentifier ?? "com.lixing.roadproof")
  guard let d = UserDefaults(suiteName: group),
        let raw = d.string(forKey: "rp_snapshot"),
        let data = raw.data(using: .utf8) else { return nil }
  return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
}

@available(iOS 16.0, *)
struct UnitEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Truck unit"
  static var defaultQuery = UnitQuery()

  var id: String
  var name: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(name)")
  }

  init(id: String, name: String) {
    self.id = id
    self.name = name
  }
}

@available(iOS 16.0, *)
struct UnitQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [UnitEntity] {
    [current()].compactMap { $0 }.filter { identifiers.contains($0.id) }
  }

  func suggestedEntities() async throws -> [UnitEntity] {
    [current()].compactMap { $0 }
  }

  func defaultResult() async -> UnitEntity? {
    current()
  }

  private func current() -> UnitEntity? {
    guard let s = snapshot() else { return nil }
    let id = s["unitId"] as? String ?? "active"
    let name = s["number"] as? String ?? "Active unit"
    return UnitEntity(id: id, name: name)
  }
}

@available(iOS 16.0, *)
struct InspectionStatusIntent: AppIntent {
  static var title: LocalizedStringResource = "Inspection status"
  static var description: IntentDescription? = IntentDescription(
    "Reports the last inspection result for a unit and how many defects are still open."
  )
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Unit")
  var unit: UnitEntity?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let s = snapshot() else {
      return .result(dialog: "No inspection yet. Open RoadProof and walk the unit.")
    }
    let number = (unit?.name) ?? (s["number"] as? String ?? "This unit")
    let overall = s["overall"] as? String ?? "notEvaluated"
    let open = s["openDefects"] as? Int ?? 0
    let today = s["checkedToday"] as? Bool ?? false

    let head: String
    switch overall {
    case "fail": head = "\(number): flagged out of service. Do not move it until the defect is signed off."
    case "warn": head = "\(number): walk-around found something to watch. Inspect again before departure."
    case "pass": head = "\(number): all answered items came back OK on the last inspection."
    default: head = "\(number) has no signed inspection yet."
    }
    let tail = " \(open) defect(s) open. \(today ? "Checked today." : "Not checked today.")"
    return .result(dialog: "\(head)\(tail)")
  }
}

@available(iOS 16.0, *)
struct OpenRoadProofIntent: AppIntent {
  static var title: LocalizedStringResource = "Open RoadProof"
  static var description: IntentDescription? = IntentDescription(
    "Opens the driver vehicle inspection record."
  )
  static var openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    return .result()
  }
}

@available(iOS 16.0, *)
struct RoadProofShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: InspectionStatusIntent(),
      phrases: [
        "Is my truck inspected in \(.applicationName)",
        "Inspection status in \(.applicationName)",
      ],
      shortTitle: "Inspection status",
      systemImageName: "checklist"
    )
    AppShortcut(
      intent: OpenRoadProofIntent(),
      phrases: ["Open \(.applicationName)", "Start a walk-around in \(.applicationName)"],
      shortTitle: "Open RoadProof",
      systemImageName: "truck.box"
    )
  }
}