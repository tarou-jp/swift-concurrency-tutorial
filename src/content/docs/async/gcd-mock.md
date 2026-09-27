---
title: GCDで非同期関数を実装する
description: ファイルの読み書きをメインスレッドの外で実行する
sidebar:
  order: 3
---


次に処理を行う関数を実行することを考えます。
・fetchTextFileURL：IDからテキストファイルの場所を取得する関数
・loadText：テキストファイルを読み取る関数
・countWords：単語数を数える関数
・saveWordCount：単語数を別のファイルへ保存する関数。
そして、上記四つの関数を連続で順番に呼び出し、その結果を返す関数。

後日イラスト埋め込み

IDからファイルの場所を取得する（非同期）→ テキストファイルを読み込む（非同期）→ 単語数を数える（同期）→ 集計結果を保存する（非同期）。

ファイルの読み書きには時間がかかる可能性があります。その間、呼び出しもとのスレッドを解放するために、ファイルを扱う処理は`DispatchQueue.global().async`の中で実行させます。つまり、ファイルを扱う処理が内部で書かれた関数は全て非同期関数になります。


```swift
import Foundation
import Dispatch

// IDからテキストファイルの場所を取得する関数
func fetchTextFileURL(
    for id: String,
    completion: @escaping (URL?) -> Void
) {
    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
        let url = Bundle.main.url(
            forResource: id,
            withExtension: "txt"
        )
        completion(url)
    }
}

// テキストファイルを読み取る関数
func loadText(
    from url: URL,
    completion: @escaping (String?) -> Void
) {
    DispatchQueue.global().async {
        let text = try? String(contentsOf: url, encoding: .utf8)
        completion(text)
    }
}

// 単語数を数える関数
func countWords(in text: String) -> Int {
    text.split { character in
        character == " " || character == "\n" || character == "\t"
    }.count
}

// 単語数を別のファイルに書き込む関数
func saveWordCount(
    _ count: Int,
    to url: URL,
    completion: @escaping (Bool) -> Void
) {
    DispatchQueue.global().async {
        let report = "単語数: \(count)"

        do {
            try report.write(
                to: url,
                atomically: true,
                encoding: .utf8
            )
            completion(true)
        } catch {
            completion(false)
        }
    }
}
```

`fetchTextFileURL`、`loadText`、`saveWordCount`は非同期関数です。処理をグローバルキューへ追加すると、その完了を待たずに呼び出しもとへ戻ります。その間、呼び出し元のスレッドは解放されます。そして、処理が成功したり、問題が発生した場合はそれが通知され、後続の処理が実行されます。

一方、`countWords`は同期関数です。処理が完了するまで、呼び出し元のスレッドはブロックされます。

## 四つの処理を順番に実行する関数

最後に、ここまでに作った四つの関数を順番に呼び出し、処理結果を返す関数を実装します。

```swift
func createWordCountReport(
    for id: String,
    to outputURL: URL,
    completion: @escaping (Bool) -> Void
) {
    fetchTextFileURL(for: id) { inputURL in
        guard let inputURL = inputURL else {
            completion(false)
            return
        }

        loadText(from: inputURL) { text in
            guard let text = text else {
                completion(false)
                return
            }

            let count = countWords(in: text)

            saveWordCount(count, to: outputURL) { succeeded in
                completion(succeeded)
            }
        }
    }
}
```

実行順は「ファイルの場所を取得 → ファイルを読み込む → 単語数を数える → 結果を保存」です。

`createWordCountReport`は非同期関数なので、すべての処理が完了する前に呼び出し元のスレッドを解放します。
そして、成功・失敗にかかわらず、処理が完了したら、その結果を呼び出し元に通知する必要があります。

今回のサンプルコードでは、完了ハンドラを呼び出すことで、処理が完了したことを呼び出し元に通知しています。

しかし、この方法には、すでに三つの問題があります。
一つ目は、処理の完了を通知し忘れても検知できないことです。
二つ目は、エラーを通常の`try`では受け取れないことです。
三つ目は、処理が増えるほどクロージャのネストが深くなることです。

## 処理の完了を通知し忘れても検知できない

呼び出し元は、次のように完了ハンドラを渡して`createWordCountReport`を呼び出します。

```swift
createWordCountReport(
    for: "article",
    to: outputURL
) { succeeded in
    if succeeded {
        print("保存が完了しました")
    } else {
        print("処理に失敗しました")
    }
}
```

完了ハンドラが呼ばれなければ、呼び出し元は処理の完了を把握できません。問題が発生した場合も同様です。たとえば、ファイルが見つからなかったときは`completion(false)`を呼び、失敗したことを通知します。

```swift
guard let inputURL = inputURL else {
    completion(false)
    return
}
```

ここで`completion(false)`を書き忘れ、次のように`return`だけを実行したとします。

```swift
// 誤った例：completionを呼ばずに終了している
guard let inputURL = inputURL else {
    return
}
```

この実装ミスはコンパイルエラーになりません。呼び出し元には成功も失敗も通知されないため、処理の完了を把握できず、後続の処理も実行されません。
完了ハンドラを使う場合は、すべての分岐で完了を通知できているか、開発者自身が確認する必要があります。

## エラーを通常の`try`では受け取れない

この例では、処理の成否を`Bool`で通知しています。一般的な関数のように、関数にthrowシグネチャをつけて、呼び出しもとではそれをtryで処理する形にはできません。

```swift
// このようには書けない
let succeeded = try createWordCountReport(
    for: "article",
    to: outputURL
)
```

## クロージャのネストが深くなる

`createWordCountReport`では、`fetchTextFileURL`の結果を受け取ってから`loadText`を実行し、`loadText`の結果を受け取ってから`saveWordCount`を実行します。後の処理が前の処理の結果を必要とするため、それぞれの処理を完了ハンドラの内側に書いています。

そのため、非同期処理が増えるたびにクロージャのネストが一段ずつ深くなります。コードのインデントも深くなり、処理がどの順番で進むのか、どの完了ハンドラの中にいるのかを追いにくくなります。

さらに、各処理の中には成功時と失敗時の分岐があります。工程が増えるほど、処理本体だけでなく、失敗を通知するためのコードもクロージャの内側に増えていきます。

処理の完了を通知する方法には、完了ハンドラのほかにDelegateもあります。Delegateではクロージャのネストは発生しませんが、処理が複数のDelegateメソッドに分散します。また、結果を戻り値として受け取れないことや、非同期処理の失敗を呼び出し元の`try`で扱えないことは完了ハンドラと同じです。そのため、処理の進行状況や成功・失敗を開発者自身で管理する必要があります。

実装したいのは「ファイルを探し、内容を読み、単語数を数え、結果を保存する」という処理です。しかし、DCDを用いた従来の実装では、処理の順番がクロージャのネストとして表れ、失敗を通知するコードも各分岐に必要になります。これが、Swift Concurrencyの導入前に非同期APIが扱いにくいとされていた理由の一つです。
