---
title: Swiftの実行環境とコンパイル設定
description: コンパイラ、language mode、strict concurrencyを分けて理解する
sidebar:
  order: 1
---

Swift Concurrencyを学ぶときは、コードそのものだけでなく、**どの環境で、どの設定でコンパイルしているか**も重要です。

同じコードでも、プロジェクトの設定によって、警告として表示される場合もあれば、コンパイルエラーになる場合もあります。
次の違いを分けて考える必要があります。

- Swiftコンパイラ
- Swift language mode
- strict concurrency checking

## Swiftコンパイラ

Swiftコンパイラは、Swiftのコードをビルドするためのプログラムです。
Xcodeを使っている場合は、Xcodeに含まれているSwiftコンパイラが使われます。
Swift Package Managerでビルドする場合も、手元に入っているSwift toolchainのコンパイラが使われます。

手元のコンパイラのバージョンは、ターミナルで確認できます。

```text
swiftc --version
```

たとえば、次のような情報が表示されます。

```text
swift-driver version: 1.120.5
Apple Swift version 6.0
```

ここで注意したいのは、**新しいSwiftコンパイラを使っていることと、新しいSwift language modeでコンパイルしていることは同じではない**という点です。

たとえば、Swift 6に対応したコンパイラを使っていても、プロジェクトがSwift 5 language modeでビルドされていることがあります。
この場合、Swift 6のコンパイラを使っていますが、言語としてはSwift 5の互換性を保つ設定でコンパイルされています。

## Swift language mode

Swift language modeは、そのコードをどのSwift言語仕様として扱うかを決める設定です。

代表的には、次のようなlanguage modeがあります。

- Swift 5
- Swift 6

Swift 6 language modeでは、Swift 5 language modeでは警告として扱われていたコードが、エラーになることがあります。
これは、既存のプロジェクトを壊さずに新しいコンパイラを導入しつつ、準備ができたプロジェクトから段階的に新しい言語モードへ移行できるようにするためです。

たとえば、同じ `main.swift` をビルドするときでも、language modeは次のように指定できます。

```text
swiftc -swift-version 5 main.swift
swiftc -swift-version 6 main.swift
```

Swift Concurrencyにおいては、Swift 6 language modeが特に重要です。
Swift 6 language modeでは、データ競合につながるコードの多くが、警告ではなくコンパイルエラーとして扱われます。

次のコードでは、`Counter` は参照型で、`value` は書き換え可能です。
その `counter` を `Task.detached` に渡すと、別の並行処理から同じインスタンスを書き換えられる可能性があります。

```swift
final class Counter {
    var value = 0
}

func incrementLater(_ counter: Counter) {
    Task.detached {
        counter.value += 1
    }
}
```

このようなコードは、設定によっては警告として表示されます。
Swift 6 language modeでは、データ競合につながる可能性のあるコードとして、コンパイルエラーになります。

## strict concurrency checking

strict concurrency checkingは、Swift Concurrencyに関するコードをどれくらい厳しく検査するかを決める設定です。

ここで検査される代表的なものには、次のようなものがあります。

- actorに隔離された状態へ、隔離領域の外から同期的にアクセスしていないか
- `@MainActor`に隔離されたUIの状態を、別の隔離領域から直接変更していないか
- `Sendable`ではない値を、isolation boundaryを越えて渡していないか
- 共有された可変状態を、複数の並行処理から安全でない形で扱っていないか

Swift 5 language modeでも、strict concurrency checkingを有効にして、Swift 6 language modeへ移行する前に問題を見つけることができます。

たとえば、コンパイラオプションでは次のように指定できます。

```text
-strict-concurrency=complete
```

この設定を使うと、将来Swift 6 language modeで問題になりやすい箇所を、移行前に見つけやすくなります。

コマンドで指定する場合は、次のように書けます。

```text
swiftc -swift-version 5 -strict-concurrency=complete main.swift
```

この指定は、「Swift 5 language modeのまま、concurrencyに関する検査を有効にしてビルドする」という意味です。
いきなりSwift 6 language modeへ切り替える前に、どのコードが問題になりそうかを確認できます。
