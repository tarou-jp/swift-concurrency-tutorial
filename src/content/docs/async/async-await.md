---
title: Swift Concurrencyで非同期関数を実装する
description: 完了ハンドラ方式の関数をasync関数へ置き換える
sidebar:
  order: 4
---

前のページでは、ファイルを探し、内容を読み、単語数を数え、その結果を保存する処理をGCDと完了ハンドラで実装しました。

続いて、同じ関数をSwift Concurrencyの`async/await`を用いて書き直します。

非同期関数には、関数宣言の引数リストの後ろに`async`を付けます。また、Errorを発生させることも可能であるため、`throws`も付けます。

```swift
func loadText(from url: URL) async throws -> String
```

前ページで作った三つの非同期関数を、全てSwift Concurrencyで再実装します。

```swift
enum WordCountError: Error {
    case fileNotFound
    case cannotReadFile
    case cannotSaveFile
}

func fetchTextFileURL(for id: String) async throws -> URL {
    // ファイルの取得に時間がかかる状況を再現する
    try await Task.sleep(nanoseconds: 1_000_000_000)

    guard let url = Bundle.main.url(
        forResource: id,
        withExtension: "txt"
    ) else {
        throw WordCountError.fileNotFound
    }

    return url
}

func loadText(from url: URL) async throws -> String {
    do {
        return try await Task.detached {
            try String(
                contentsOf: url,
                encoding: .utf8
            )
        }.value
    } catch {
        throw WordCountError.cannotReadFile
    }
}

func saveWordCount(_ count: Int, to url: URL) async throws {
    let report = "単語数: \(count)"

    do {
        try await Task.detached {
            try report.write(
                to: url,
                atomically: true,
                encoding: .utf8
            )
        }.value
    } catch {
        throw WordCountError.cannotSaveFile
    }
}
```

三つの関数はいずれも、処理結果を`return`し、失敗した場合はエラーを`throw`しています。

前ページの実装では、非同期関数の処理が完了したことを、完了ハンドラを用いてコード上で明示的に通知していました。`async`関数では、この明示的な通知が不要となり、通常の関数と同じように処理結果を`return`し、問題が起きたらエラーを`throw`できます。

三つの非同期関数を再実装したので、処理全体は次のように再実装します。

```swift
func createWordCountReport(
    for id: String,
    to outputURL: URL
) async throws {
    let inputURL = try await fetchTextFileURL(for: id)
    let text = try await loadText(from: inputURL)
    let count = countWords(in: text)
    try await saveWordCount(count, to: outputURL)
}
```

コードの可読性が上がったことは一目でわかると思います。
`async/await`を使った実装では、実際に処理が進む順番と同じように、ネストせずに、処理を行う関数を上から下へ並べることができています。
また、Errorを直接扱うことができるため、内部の非同期関数でErrorが発生した場合もそれを直接、`createWordCountReport`の呼び出しもとにそのまま伝えることができます。前ページの実装のように、一つ一つエラーが発生した際にそれをそのまま呼び出しもとに通知するコードを書く必要もなくなります。
```
guard let inputURL = inputURL else {
    completion(false)
    return
}
```

結果として、全ページの実装が抱えていた問題は全て解決され、さらに、処理内容は全く同じですが、コード行数は25行から9行へと減りました。
