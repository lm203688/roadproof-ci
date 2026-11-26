import SwiftUI
import WidgetKit

private var appGroup: String {
  var id = Bundle.main.bundleIdentifier ?? ""
  if id.hasSuffix(".widget") { id = String(id.dropLast(".widget".count)) }
  return "group." + id
}

struct RPEntry: TimelineEntry {
  let date: Date
  let number: String
  let overall: String
  let openDefects: Int
  let checkedToday: Bool
  let hasData: Bool
}

struct RPProvider: TimelineProvider {
  func placeholder(in context: Context) -> RPEntry {
    RPEntry(date: Date(), number: "UNIT 104", overall: "pass", openDefects: 0, checkedToday: true, hasData: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (RPEntry) -> Void) { completion(read()) }

  func getTimeline(in context: Context, completion: @escaping (Timeline<RPEntry>) -> Void) {
    let entry = read()
    let next = Calendar.current.startOfDay(for: Date()).addingTimeInterval(86400)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func read() -> RPEntry {
    guard let d = UserDefaults(suiteName: appGroup),
          let raw = d.string(forKey: "rp_snapshot"),
          let data = raw.data(using: .utf8),
          let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
      return RPEntry(date: Date(), number: "", overall: "notEvaluated", openDefects: 0, checkedToday: false, hasData: false)
    }
    return RPEntry(
      date: Date(),
      number: obj["number"] as? String ?? "Unit",
      overall: obj["overall"] as? String ?? "notEvaluated",
      openDefects: obj["openDefects"] as? Int ?? 0,
      checkedToday: obj["checkedToday"] as? Bool ?? false,
      hasData: true
    )
  }
}

struct RPView: View {
  var entry: RPEntry

  private var ink: Color { Color(red: 0.071, green: 0.098, blue: 0.090) }
  private var sub: Color { Color(red: 0.361, green: 0.396, blue: 0.376) }
  private var accent: Color { Color(red: 0.059, green: 0.420, blue: 0.329) }
  private var warn: Color { Color(red: 0.706, green: 0.376, blue: 0.039) }
  private var fail: Color { Color(red: 0.639, green: 0.169, blue: 0.129) }
  private var bg: Color { Color(red: 0.969, green: 0.973, blue: 0.969) }

  private var statusText: String {
    switch entry.overall {
    case "fail": return "OUT"
    case "warn": return "WATCH"
    case "pass": return "OK"
    default: return "NO DATA"
    }
  }
  private var statusColor: Color {
    switch entry.overall {
    case "fail": return fail
    case "warn": return warn
    case "pass": return accent
    default: return sub
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text("INSPECTION")
        .font(.system(size: 9, weight: .semibold))
        .tracking(0.8)
        .foregroundStyle(sub)

      if entry.hasData {
        Text(statusText)
          .font(.system(size: 26, weight: .bold, design: .rounded))
          .foregroundStyle(statusColor)
        Text(entry.number)
          .font(.system(size: 13, weight: .semibold))
          .lineLimit(1)
          .foregroundStyle(ink)
        Text(entry.checkedToday ? "checked today · \(entry.openDefects) open" : "not checked today · \(entry.openDefects) open")
          .font(.system(size: 10))
          .foregroundStyle(sub)
      } else {
        Text("Not inspected")
          .font(.system(size: 20, weight: .bold, design: .rounded))
          .foregroundStyle(ink)
        Text("Open RoadProof and walk the unit")
          .font(.system(size: 10))
          .lineLimit(2)
          .foregroundStyle(sub)
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(12)
    .containerBackground(bg, for: .widget)
  }
}

@main
struct RoadProofWidget: Widget {
  let kind = "RoadProofStatus"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: RPProvider()) { entry in
      RPView(entry: entry)
    }
    .configurationDisplayName("Inspection status")
    .description("Shows whether this unit was inspected today and how many defects are still open.")
    .supportedFamilies([.systemSmall])
  }
}