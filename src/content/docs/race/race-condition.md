---
title: 競合状態とは
description: 同期されていても、順番で結果が変わることがある
sidebar:
  order: 3
---

**データ競合**とよく混在される概念に**競合状態**があります。
**競合状態**とは、複数の処理が実行される順番によって、結果が変わる状態です。

例えば、在庫が1個の商品を二人が購入する場合です。下の例の`Inventory`は、在庫へのアクセスを直列キューで保護しています。

```swift
import Dispatch

final class Inventory {
    private var stock = 1
    private let queue = DispatchQueue(label: "inventory")

    func hasStock() -> Bool {
        return queue.sync {
            stock > 0
        }
    }

    func purchase() {
        queue.sync {
            stock -= 1
        }
    }

    func currentStock() -> Int {
        return queue.sync {
            stock
        }
    }
}

let inventory = Inventory()
let customerQueue = DispatchQueue(
    label: "customers",
    attributes: .concurrent
)
let group = DispatchGroup()

for customer in ["A", "B"] {
    group.enter()

    customerQueue.async {
        if inventory.hasStock() {
            inventory.purchase()
            print("\(customer)が購入しました")
        }

        group.leave()
    }
}

group.wait()
print("残りの在庫: \(inventory.currentStock())")
```

`hasStock()`、`purchase()`、`currentStock()`は、いずれも`inventory`の直列キュー上で実行されます。そのため、`stock`を同時に読み書きするデータ競合はありません。

しかし、「在庫を確認する」と「在庫を減らす」は別々の操作です。実行されるタイミングによっては、次の順番になります。

後日イラスト埋め込み

1. Aが在庫を確認し、「1個ある」と判断する。
2. Bも在庫を確認し、「1個ある」と判断する。
3. Aが購入し、在庫を`0`にする。
4. Bも購入し、在庫を`-1`にする。

確認した時点では、AもBも「在庫は1個」と判断しています。その後に二人がそれぞれ1個減らすと、在庫は`1 → 0 → -1`になります。

実行順が異なり、Aの購入が終わってからBが在庫を確認すれば、残りの在庫は`0`です。結果が処理の順番に左右されるため、これは競合状態です。

この問題を防ぐには、「在庫を確認し、在庫を減らす」ところまでを一つの操作として実装します。

```swift
func purchaseIfAvailable() -> Bool {
    return queue.sync {
        guard stock > 0 else {
            return false
        }

        stock -= 1
        return true
    }
}
```

このメソッドは`Inventory`の内部へ追加します。確認と更新の間に別の購入処理が入らないため、一つの在庫を二人が購入することはありません。

Swift Concurrencyはデータ競合を防ぐことで、共有された可変状態を安全に扱うことを可能にしますが、競合状態においては、処理の順番を適切に設計して実装してあげる必要があります。
