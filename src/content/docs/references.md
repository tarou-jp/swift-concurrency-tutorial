---
title: 参考資料
description: 原稿に挙げた一次資料
---

## 非同期処理と async/await

- Chris Lattner, [Swift Concurrency Manifesto](https://gist.github.com/lattner/31ed37682ef1576b16bca1432ea9f782)（構想の背景）
- Apple, [Meet async/await in Swift](https://developer.apple.com/videos/play/wwdc2021/10132/)（完了ハンドラと `async/await` の比較）
- Apple, [Protect mutable state with Swift actors](https://developer.apple.com/videos/play/wwdc2021/10133/)（データ競合とactor）
- Swift Evolution, [SE-0296: Async/await](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0296-async-await.md)（中断と再開の仕様）
- Swift Evolution, [SE-0300: Continuations for interfacing async tasks with synchronous code](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0300-continuation.md)（完了ハンドラからの橋渡し）

## データ競合と actor

- [Swift Concurrency Manifesto](https://gist.github.com/lattner/31ed37682ef1576b16bca1432ea9f782)
- [Swift公式ドキュメント：Concurrency](https://docs.swift.org/latest/documentation/the-swift-programming-language/concurrency/)
- [Swift公式ドキュメント：Structures and Classes](https://docs.swift.org/swift-book/LanguageGuide/ClassesAndStructures.html)
- [Swift 6移行ガイド：Data Race Safety](https://www.swift.org/migration/documentation/swift-6-concurrency-migration-guide/dataracesafety/)
- Yuta Koshizawa, [Heart of Swift Concurrency](https://speakerdeck.com/koher/heart-of-swift-concurrency?slide=24)
- Swift Zoomin', [感覚的に理解するConcurrency: Swift 6はIsolationとSendableを用いてどのようにデータ競合を防止するか](https://www.youtube.com/watch?v=AUcn2y2jjNs&t=1042s)
