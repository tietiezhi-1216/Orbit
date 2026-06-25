//  DictationStatsView.swift
//  听写 › 统计: at-a-glance usage derived entirely from the history store — totals,
//  a 7-day activity sparkline, and the distribution across polish modes.

import SwiftUI

struct DictationStatsView: View {
    @EnvironmentObject var history: DictationHistoryStore

    private var entries: [DictationEntry] { history.entries }

    var body: some View {
        PageScaffold(title: "听写 · 统计") {
            Form {
                Section("概览") {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        statCard("总次数", "\(entries.count)", "waveform")
                        statCard("今日", "\(todayCount)", "sun.max")
                        statCard("总字数", "\(totalChars)", "textformat.size")
                        statCard("自动输入率", insertRate, "arrow.down.doc")
                    }
                    .padding(.vertical, 4)
                }

                Section("最近 7 天") {
                    if entries.isEmpty {
                        empty
                    } else {
                        WeekBars(counts: last7Days)
                            .frame(height: 92)
                            .padding(.vertical, 6)
                    }
                }

                Section("按模板") {
                    if entries.isEmpty {
                        empty
                    } else {
                        let dist = modeDistribution
                        let maxN = max(dist.map(\.count).max() ?? 1, 1)
                        ForEach(dist, id: \.label) { item in
                            modeBar(item.label, count: item.count, max: maxN)
                        }
                    }
                }
            }
            .formStyle(.grouped)
        }
    }

    private var empty: some View {
        Text("还没有数据。开始听写后这里会有统计。")
            .font(.caption).foregroundStyle(.secondary)
    }

    // MARK: Derived stats

    private var todayCount: Int {
        entries.filter { Calendar.current.isDateInToday($0.date) }.count
    }
    private var totalChars: Int {
        entries.reduce(0) { $0 + $1.finalText.count }
    }
    private var insertRate: String {
        guard !entries.isEmpty else { return "—" }
        let n = entries.filter { $0.inserted }.count
        return "\(Int((Double(n) / Double(entries.count) * 100).rounded()))%"
    }

    /// Counts for the last 7 calendar days, oldest → newest.
    private var last7Days: [(label: String, count: Int)] {
        let cal = Calendar.current
        let fmt = DateFormatter(); fmt.dateFormat = "E"
        return (0..<7).reversed().map { offset in
            let day = cal.date(byAdding: .day, value: -offset, to: Date()) ?? Date()
            let count = entries.filter { cal.isDate($0.date, inSameDayAs: day) }.count
            return (fmt.string(from: day), count)
        }
    }

    /// The label an entry counts under: its template name, or 仅转写 for raw /
    /// 润色 for legacy polished entries with no recorded template.
    private func modeKey(_ e: DictationEntry) -> String {
        if let m = e.mode { return m == "raw" ? "仅转写" : m }
        return e.polished != nil ? "润色" : "仅转写"
    }

    private var modeDistribution: [(label: String, count: Int)] {
        Dictionary(grouping: entries, by: modeKey)
            .map { (label: $0.key, count: $0.value.count) }
            .sorted { $0.count > $1.count }
    }

    // MARK: Components

    private func statCard(_ title: String, _ value: String, _ symbol: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 18))
                .foregroundStyle(Color.accentColor)
                .frame(width: 26)
            VStack(alignment: .leading, spacing: 1) {
                Text(value).font(.system(size: 20, weight: .semibold, design: .rounded))
                Text(title).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(12)
        .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func modeBar(_ label: String, count: Int, max: Int) -> some View {
        HStack(spacing: 10) {
            Text(label)
                .font(.system(size: 13))
                .lineLimit(1)
                .frame(width: 110, alignment: .leading)
            GeometryReader { geo in
                Capsule()
                    .fill(Color.accentColor.opacity(0.85))
                    .frame(width: max > 0 ? geo.size.width * CGFloat(count) / CGFloat(max) : 0)
                    .frame(maxHeight: .infinity, alignment: .leading)
            }
            .frame(height: 14)
            Text("\(count)").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                .frame(width: 32, alignment: .trailing)
        }
        .padding(.vertical, 2)
    }
}

/// Simple 7-day vertical bar sparkline.
private struct WeekBars: View {
    let counts: [(label: String, count: Int)]

    var body: some View {
        let maxN = max(counts.map(\.count).max() ?? 1, 1)
        HStack(alignment: .bottom, spacing: 8) {
            ForEach(Array(counts.enumerated()), id: \.offset) { _, item in
                VStack(spacing: 4) {
                    Text("\(item.count)")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .opacity(item.count > 0 ? 1 : 0.4)
                    GeometryReader { geo in
                        let h = maxN > 0 ? geo.size.height * CGFloat(item.count) / CGFloat(maxN) : 0
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .fill(Color.accentColor.opacity(item.count > 0 ? 0.85 : 0.18))
                            .frame(height: max(h, 3))
                            .frame(maxHeight: .infinity, alignment: .bottom)
                    }
                    Text(item.label).font(.caption2).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}
