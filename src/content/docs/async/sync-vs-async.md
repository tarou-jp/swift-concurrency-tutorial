---
title: 非同期処理と同期処理の違い
description: 処理の完了を待ってから次へ進むか、待たずに進むか
sidebar:
  order: 2
---

処理の実行方法は、非同期処理と同期処理の二つに分けられます。

**同期処理**では、呼び出した処理が終わるまで、呼び出し元は次の処理へ進みません。

```swift
print("開始")
let data = loadData()
print(data)
print("終了")
```

実行結果
```
開始
`data`
終了
```

`loadData()`が完了して結果が帰ってくるまで、後続の`print`は実行されません。コードに書かれた順番と、処理が完了する順番が一致します。

**非同期処理**では、時間のかかる処理の完了をその場で待たず、呼び出し元はいったん次へ進みます。そして、処理が完了したら、その結果を受け取り後続の`print`を実行します。

```swift
print("開始")

loadData { data in
    print(data)
}

print("終了")
```

実行結果
```
開始
終了
`data`
```


後日イラスト埋め込み

さらに複雑な例で、同期処理と非同期処理の違いを理解しましょう

次のSwiftUIアプリでは、ボタンを押すと`loadDataSynchronously()`が3秒間待機したのちに、結果を返します。この関数は同期関数なので、結果が返るまで次の処理へ進めません。

```swift
import SwiftUI

func loadDataSynchronously() -> String {
    Thread.sleep(forTimeInterval: 3)
    return "取得したデータ"
}

struct SynchronousView: View {
    @State private var isLoading = false
    @State private var message = "データはありません"

    var body: some View {
        VStack(spacing: 16) {
            if isLoading {
                ProgressView()
            }

            Text(message)

            Button("データを読み込む") {
                isLoading = true
                message = loadDataSynchronously()
                isLoading = false
            }
        }
    }
}
```

`loadDataSynchronously()`は同期関数であるため、この関数が実行されているスレッドは後続の処理を行うことができません。そして、この関数が実行されているのはUIを処理するメインスレッドです。そのため、データを取得している3秒間は、画面を更新することができず、アプリ上はボタンを押した時点から全く動かなくなります。ローディングスピナーすら表示されません。3秒後にデータが帰ってから、画面が更新されます。

後日イラスト埋め込み

次に、同じ処理を非同期関数として実装した例です。`loadDataAsynchronously()`は3秒後に結果を返します。しかし、その間は呼び出し元のメインスレッドを解放します。そして、処理が完了したら、処理結果をメインスレッドに通知します。

```swift
import SwiftUI
import Dispatch

func loadDataAsynchronously(
    completion: @escaping @MainActor @Sendable (String) -> Void
) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
        completion("取得したデータ")
    }
}

struct AsynchronousView: View {
    @State private var isLoading = false
    @State private var message = "データはありません"

    var body: some View {
        VStack(spacing: 16) {
            if isLoading {
                ProgressView()
            }

            Text(message)

            Button("データを読み込む") {
                isLoading = true

                loadDataAsynchronously { data in
                    message = data
                    isLoading = false
                }
            }
        }
    }
}
```

今度は、データを待っている間もメインスレッドが止まりません。画面にはローディングスピナーが表示され、3秒後にデータを受け取ると、その内容が画面に表示されます。

後日イラスト埋め込み

この例では、GCDの`asyncAfter`を使って非同期処理を実装しました。次のページでは、Swift Concurrency以前の非同期処理の実装方法を解説します。