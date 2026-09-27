---
title: Swift Concurrencyの思想
description: マニフェストから、導入の理由を読み解く
sidebar:
  order: 2
---

まず、`concurrency` という言葉を確認します。日本語では「並行処理」、「並行性」と訳されます。

コンピュータの世界では、以下の用語として扱われることが多いです。
・並列処理：複数の処理装置(一般的にはCPUのコア)を用いて、複数の処理を同時に実行する技術。
・並行処理：一つの処理装置が、複数の処理を高速に切り替えながら処理を行う技術。これにより、複数の処理が同時に実行されているように見える。
・非同期処理：あるコンピュータがある処理の完了を待たずに次の別の処理を開始・実行する仕組み。

後日イラスト埋め込み

このチュートリアルでは、Concurrency = 非同期処理を指す用語として解釈します。

Swift Concurrencyが登場する前のSwift 1〜4でも、GCDやスレッドを使えば非同期処理を実装することができました。では、なぜ新たにSwift Concurrencyを導入する必要があったのでしょうか。

その理由は、Swiftの生みの親であるChris Lattnerが2017年に公開した [Swift Concurrency Manifesto](https://gist.github.com/lattner/31ed37682ef1576b16bca1432ea9f782) から読み取ることができます。この文書は、Swift Evaluationに提出された計画書であり、Swift Concurrency導入以前にか変えていた問題、如何にしてその問題を解決するのかの多くがすでに示されています。

この計画書で指摘されている、Swift Concurrency導入以前にか変えていた問題のうち、大きなものが以下の二つです。

## 課題1：非同期APIが扱いにくい

> “Modern Cocoa development involves a lot of asynchronous programming using closures and completion handlers, but these APIs are hard to use.”

現代のGCD(Grand Central Dispatch)を用いた開発では、クロージャや完了ハンドラを使う非同期処理が数多く登場する。これらのAPIは扱いにくい。
という指摘です。
第1部では、この課題を扱います。Swift Concurrency導入以前の実装方法を確認し、同じ処理をSwift Concurrencyで再実装します。

## 課題2：共有された可変状態が危険である

マニフェストは、もう一つの問題を次のように説明しています。

> “The concern is when the shared data is mutable, and therefore someone is changing it while others tasks are looking at it.”

問題になるのは、共有されたデータが変更可能であり、ある処理が変更しているあいだに、別の処理も同じデータを見ている場合です。
さらに、安全性について、当時のSwiftは競合状態やデッドロックなどの問題を防ぐ手助けをしていないと指摘し、“safe by default” なプログラミングモデルを目標に掲げています。

第2部では、こちらの課題を扱います。まずデータ競合が起きる条件を確認します。その後、コンパイラルにより、データ競合を招く実装を検出する仕組みを解説します。

