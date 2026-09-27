---
title: 可変状態を共有しない
description: データ競合を避けるための一つの選択肢
sidebar:
  order: 5
---

共有された可変状態を安全に扱う最も単純な方法は、そもそも共有しないことです。各Taskが別々の値を持てば、片方のTaskによる変更は、もう片方のTaskに影響しません。

例として、先ほどの`Counter`を参照型の`class`ではなく、値型の`struct`を使って再実装します。`increment()`は自分の`value`を書き換えるので、`mutating`を付けます。

```swift
struct Counter {
    var value = 0

    mutating func increment() -> Int {
        value = value + 1
        return value
    }
}

func runWithCopies() {
    let counter = Counter()

    Task.detached {
        var localCounter = counter
        print(localCounter.increment()) // 1
    }
    Task.detached {
        var localCounter = counter
        print(localCounter.increment()) // 1
    }
}
```

`struct`は値型です。各Taskの`var localCounter = counter`では、それぞれがcounterのコピーがlocalCounterに代入されます。AのTaskが値を増やしても、BのTaskが持つ値は変わりません。両方が`0`から始めるので、二つの出力は`1`と`1`です。

元の`class Counter`では、二つのTaskが同じインスタンスを指していました。今回の`struct Counter`では、二つのTaskがそれぞれ自分の値を変更します。

ただし、実際のアプリケーションでは、Taskが各自の値を変更するだけでは解決できない問題が出てきます。例えば二つの画面から同じカウンターを増やし、更新された結果を画面にも表示したいなら、どうすればいいのでしょうか。

そこで考えることが、**処理同士がどう協力しながら、同じ可変データを自由に読み書きしないで済むか**です。これを解決する一つの考え方が、アクターモデルです。
