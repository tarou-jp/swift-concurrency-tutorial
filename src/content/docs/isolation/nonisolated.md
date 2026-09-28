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

`sailTheSea()` は、どの **isolation domain** にも属していません。そのため、actor の中からでも `await` なしで呼べます。

```swift
actor Ship {
    func go() {
        sailTheSea()
    }
}
```

逆に、`sailTheSea()` の中から actor の状態へは触れません。`course` は `Ship` の **isolation domain** に隔離されているからです。

```swift
actor Ship {
    var course = "北"
}

func sailTheSea(ship: Ship) {
    ship.course = "南" // コンパイルエラー
}
```

境界を越えて状態を読み書きする場合には、`await` を使います。

```swift
extension Ship {
    func go() {
        course = "南"
    }
}

func sailTheSea(ship: Ship) async {
    await ship.go()
}
```

`Chicken` も non-isolated です。`currentHunger` を持っていて、それが `var` であり可変状態を持っていますが、このクラスの定義はコンパイルできます。

actor が二つあります。どちらも、`Chicken` を受け取る関数を持っています。この二つの定義も、コンパイルできます。

```swift
actor Barn {
    func look(at chicken: Chicken) {
        print(chicken.currentHunger)
    }
}

actor Coop {
    func feed(_ chicken: Chicken) {
        chicken.currentHunger = .full
    }
}
```

`Barn.look` は `currentHunger` を読みます。`Coop.feed` は `.full` に書き換えます。

しかし、次のように同時にnon-isolatedな可変状態を読み書きしようとした時にはどうなるでしょう。

```swift
func morning(barn: Barn, coop: Coop) async {
    let chicken = Chicken(name: "まる", currentHunger: .hungry)
    await barn.look(at: chicken) // コンパイルエラー
    await coop.feed(chicken)
}
```

`morning` は non-isolated です。`await` で順番に書いてあっても、`Barn` と `Coop` は別々の **isolation domain** なので、同じ `currentHunger` を同時に触れることがあります。swiftはコンパイラによりこのデータ競合のリスクを検知してコンパイルエラーにします。

actor や global actor に隔離された型の中でも、メソッドに `nonisolated` を付けると、そのメソッドは non-isolated になります。その書き方は、actor のページで見ます。
