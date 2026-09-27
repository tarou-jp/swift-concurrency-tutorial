---
title: non-isolated
description: 隔離を明示しないときの既定
sidebar:
  order: 8
---

隔離されない状態や関数を**non-isolated**と呼びます。

```swift
func sailTheSea() {
}
```

この**トップレベルの関数**にはアクターによる隔離も、グローバルアクターによる隔離もありません。

型も同じです。以下の 純粋なclass は、 non-isolated です。

```swift
enum HungerLevel {
    case hungry
    case full
}

class Chicken {
    let name: String
    var currentHunger: HungerLevel

    init(name: String, currentHunger: HungerLevel) {
        self.name = name
        self.currentHunger = currentHunger
    }
}
```

これらの**non-isolated**な状態や関数は自由に他の**isolation domain**の状態や関数にアクセスすることはできません。
一方で、他の**isolation domain**からは自由にアクセスされます。

また、actor や global actor に隔離された型の中でも、メソッドに `nonisolated` を付けると、そのメソッドは non-isolated になります。その書き方は、actor のページで見ます。
