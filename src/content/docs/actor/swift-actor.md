---
title: actorの値への隔離
description: インスタンスごとに isolation domain を持つ
sidebar:
  order: 9
---

`actor` 型の書き方については、[アクターモデルの導入](/actor/theory/)で扱いました。

`actor`型はインスランスごとに**isolation domain**ができます。`Inventory()` を二回呼べば、それぞれの `stock` は別の**isolation domain**に隔離されます。

`actor`の隔離は、メソッドごとに外すことも可能です。隔離したくない状態や関数はnonisolated修飾子をつけることによりnon-isolatedに変更することができます。

```swift
extension Inventory {
    nonisolated func label() -> String {
        "在庫"
    }
}
```

このnon-isolatedにした`label()`の中では、隔離領域の中の`stock`にアクセスすることはできません。

また、関数の引数としてactor型を受け取る場合場合、 `isolated`修飾子をつけることで引数で受け取ったアクターインスタンスの**isolation domain**の中で関数の処理を行うことができます。これは、actor型の中に関数を書いているのと同じことをいみします。

```swift
func purchase(from inventory: isolated Inventory) -> Int {
    inventory.stock = inventory.stock - 1
    return inventory.stock
}
```

`isolated` を付けない関数は、`stock` へ代入できません。

```swift
func purchase(from inventory: Inventory) -> Int {
    inventory.stock = inventory.stock - 1 // コンパイルエラー
    return inventory.stock
}
```

呼び出し方も、actor型の中に定義した関数と同じです。すでにそのアクターインスタンスの**isolation domain**の中にいるため、隔離された状態、関数を`await` なしで呼べます。そして、この関数を呼び出す側は`await`をつけて呼び出す必要があります。

```swift
extension Inventory {
    func purchaseFromSelfAndFriend(friend: Inventory) async -> Int {
        let mine = purchase(from: self)
        let theirs = await purchase(from: friend)
        return mine + theirs
    }
}
```

