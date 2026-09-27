---
title: 共有された可変状態とは
description: 複数の処理が、同じ書き換え可能なデータを扱うこと
sidebar:
  order: 1
---

Swift Concurrencyの思想を理解するうえで欠かせない、**共有された可変状態**とは何でしょうか。

**状態**とは、プログラムが使用するデータです。
**共有**とは、同じ状態を複数のTask、スレッド、キューなどが使うことです。
**可変**とは、その状態を実行中に書き換えられることをいみします。

次の`Counter`では、現在の数を表す`value`が可変状態です。一つの`Counter`インスタンスが、二つのキューから使われています。そして、一方のキューではデータが書き換えられています。
よって、以下の例ではCounter.valueは共有された可変状態と言えます。

```swift
import Dispatch

final class Counter {
    var value = 0
}

let counter = Counter()
let queueA = DispatchQueue(label: "queue-a")
let queueB = DispatchQueue(label: "queue-b")

queueA.async {
    counter.value = 1
}

queueB.async {
    print(counter.value)
}
```


後日イラスト埋め込み

共有された可変状態があるだけで、必ず問題が起きるわけではありません。しかし、適切に実装されていないと、**データ競合**や**競合状態**を引き起こします。
