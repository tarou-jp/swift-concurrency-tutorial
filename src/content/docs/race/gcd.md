---
title: 従来のGCDでは、共有された可変状態をどう扱ったか
description: 直列キューと、開発者が守るアクセス規則
sidebar:
  order: 4
---

Swift Concurrencyが導入される以前も、共有された可変状態を安全に扱う方法はありました。GCDでは、特定のデータを扱うための直列キューを作り、読み取りと書き込みを必ずそのキューへ追加する方法がよく使われていました。

```swift
let counter = Counter()
let counterQueue = DispatchQueue(label: "counter")

counterQueue.async {
    print(counter.increment()) // 書き込み
}
counterQueue.async {
    print(counter.value)       // 読み取り
}
```

キューに登録した二つの処理は、同時には実行されません。キューの中では必ず同時に一つの処理しか行われません。これにより、読み取りと書き込みが同時に行われることはなく、**データ競合**は起こりません。

しかし、それは**Counterへのアクセスをすべてこのキューの中で実装したら**、の話です。

もし、後から別の画面で、次のような処理が追加されたらどうでしょうか。

```swift
DispatchQueue.main.async {
    print(counter.value) // counterQueueを通さずに読み取る
}
```

この処理は別のキューから`value`を読んでいます。よって、最初の書き込みと実行が重なる可能性があり、データ競合が起こりえます。

共有された可変状態は、`NSLock`などのロックでも守れます。この場合も、「値へ触る前に必ずロックし、終わったら解除する」というルールを、すべてのアクセス箇所で守る必要があります。

問題は、`Counter`の定義を見ても「`value`には必ず`counterQueue`からアクセスする」というルールがわからず、またルール違反を検知することもできないことです。
