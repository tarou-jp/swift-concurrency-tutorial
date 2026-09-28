---
title: isolation domainによるデータ隔離
description: どの状態を、どの処理が扱えるかを区切る
sidebar:
  order: 7
---

Swift Concurrencyではアクターモデルをさらに拡張して、状態とその状態を扱うプログラムを隔離する**isolation domain(隔離領域)**を定義しています。
ある**isolation domain**に属する可変状態は、同じ隔離領域にいるコードからのみ同期的にアクセスされます。

別の**isolation domain**にいるプログラムは、その状態を自由に読み書きできません。**isolation domain**の境界(**isolation boundary**と一般的に呼ばれる)を越えてデータをやり取りする場合は、`await`を使います。この越え方は、[isolation domainを超えたデータのやり取り](/isolation/boundary/)で扱います。

全ての状態や関数は以下の三種類の**isolation domain**のいずれかに属します。

- **non-isolated**：隔離されていない状態や関数。
- **actor の値への隔離**：特定の`actor`に隔離されている状態や関数。
- **global actor への隔離**。`MainActor` のような global actor に隔離されている状態や関数。

次のページから、この三つを順に見ていきます。
