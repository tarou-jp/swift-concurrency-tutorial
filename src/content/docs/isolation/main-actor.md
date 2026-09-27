---
title: global actorへの隔離
description: アプリ全体で共有される一つの actor
sidebar:
  order: 10
---

**global actor** は、アプリ全体で共有される一つの`actor`です。前のページの`actor`の例のように、`actor`はインスタンスごとに独立した**isolation domain**を持つのに対して**global actor**はアプリケーション全体で一つの**isolation domain**を持ちます。

では、global actorで状態、関数を隔離する例を、最も有名なglobal actorである`MainActor`を例に解説します。
`MainActor`は最初からシステムが用意している`global actor`であり、全ての処理がメインスレッド上で実行されるという特徴があります。

global actor への隔離は、クラス、関数、変数の宣言にアノテーションを書いて行います。`MainActor` なら `@MainActor` です。

```swift
@MainActor
class GameLibraryViewController: UIViewController {
    func updateUI() {
        // 画面に出ている表示を更新する
    }
}

@MainActor
var libraryTitle = "ゲーム"

@MainActor
func reloadLibrary() {
    libraryTitle = "更新したゲーム"
}
```

クラスに`@MainActor`をつけると、そのクラスのプロパティ、メソッドも`MainActor`の**isolation domain**に隔離されます。
関数や、変数には、それぞれの宣言に直前に、クラスと同様に`@MainActor`をつけることで**isolation domain**に隔離されます。`libraryTitle` と `reloadLibrary()` はクラスの外にありますが、`GameLibraryViewController` と同じ**isolation domain**に隔離されます。

## 自分で作る global actor

`MainActor`は最初から用意されている`global actor`ですが、自身で**global actor**を定義することもできます。
以下の例の通り、`@globalActor`アノテーションをつけることで、アプリ全体で共有される`global actor`を定義することができます。

```swift
struct Videogame {
    var title: String
}

@globalActor
struct MediaActor {
    actor ActorType { }
    static let shared = ActorType()
}

@MediaActor
var videogames: [Videogame] = []

@MediaActor
func addGame(_ game: Videogame) {
    videogames.append(game)
}
```

`videogames` と `addGame` は、どちらも `MediaActor.shared` に隔離されます。
そして、`MediaActor` の外から `addGame` を呼ぶ時には、`await` が必要です。

```swift
func register(_ game: Videogame) async {
    await addGame(game)
}
```

後日イラスト埋め込み
