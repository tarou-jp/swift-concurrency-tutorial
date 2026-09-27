---
title: isolation domainを超えたデータのやり取り
description: 境界を越える値と Sendable
sidebar:
  order: 11
---

**isolation domain**は可変状態を隔離することで、データ競合を防ぎます。しかし、アプリケーションを作る上では、**isolation domain**を超えて値の受け渡しが必要となる場面が発生します。

たとえば、以下のようなサンプルコードを考えてみましょう。
在庫数を管理するために、Stockという構造体を定義します。そして、viewが持つ状態を管理する`inventoryViewModel`がこの構造体のインスタンスを持ちます。そして、viewModelの持つ状態により、viewが更新されるため、viewModelには、`@MainActor`を付与します。これは、swiftではUIに関する処理は全てメインスレッド上で行う必要があるためです。
画面を表示するInventoryViewでは、現在の在庫数と、販売するボタンが置かれています。

```swift
struct Stock {
    var count = 1
}

@MainActor
@Observable
class InventoryViewModel {
    var stock = Stock()

    func sell() {
        stock.count -= 1
    }
}

struct InventoryView: View {
    @State private var viewModel = InventoryViewModel()

    var body: some View {
        VStack {
            Text("在庫: \(viewModel.stock.count)")

            Button("販売する") {
                viewModel.sell()
            }
        }
    }
}
```

この例では、全ての状態は`MainActor`という`global actor`に隔離されています。

では、次に在庫数は外部のDBで管理されている場合の実装例を考えてみましょう。

```swift
struct Stock: Sendable {
    var count: Int
}

actor StockRepository {
    private var cachedStock: Stock?

    func loadStock() async -> Stock {
        // DBからStockを取得し、cachedStockに保存して返す処理は省略
    }

    func sell() async -> Stock {
        // DBの在庫を1つ減らし、更新後のStockを
        // cachedStockに保存して返す処理は省略
    }
}

@MainActor
@Observable
class InventoryViewModel {
    private let repository = StockRepository()
    var stock: Stock?

    func load() async {
        stock = await repository.loadStock()
    }

    func sell() async {
        stock = await repository.sell()
    }
}

struct InventoryView: View {
    @State private var viewModel = InventoryViewModel()

    var body: some View {
        VStack {
            if let stock = viewModel.stock {
                Text("在庫: \(stock.count)")

                Button("販売する") {
                    Task {
                        await viewModel.sell()
                    }
                }
            } else {
                Text("在庫を読み込み中")
            }
        }
        .task {
            await viewModel.load()
        }
    }
}
```

このサンプルコードでは、在庫数の取得、更新をrepositoryを通して行っています。そして、このrepositoryは`MainActor`ではない、異なる**isolation domain**に隔離されています。
そして、上記の例では、`stock = await repository.sell()`の箇所で、**isolation domain**を超えて在庫という状態が渡されています。
今回の場合、viewに関する処理は必ず`MainActor`上で実行する必要があるという制約のもと、repositoryの**isolation domain**から在庫数という状態を**isolation boundary**を超えて、共有する必要がありました。

しかし、どんな値でもこの境界を超えられるようにしていいわけではありません。
**isolation boundary**を超えて安全に共有しても良い値と、そうでない値を区別する必要があります。
Swift Concurrencyでは、`Sendable`というプロトコルを通じてこの区別を行います。
`Sendable` に準拠した値だけが、この境界を越えられます。
そして、先ほどのサンプルコードでは、渡されたのはStockでした。そしてこのStockは`Sendable`に準拠していたため、**isolation boundary**を超えることができていました。

ではここからは、このサンプルコードを少し修正して、どのような値であれば`Sendable`に準拠ができて、どのような値であれば`Sendable`に準拠できないのかを理解します。


```swift
class Stock: Sendable {
    var count: Int

    init(count: Int) {
        self.count = count
    }
}

actor StockRepository {
    private var cachedStock: Stock?

    func loadStock() async -> Stock {
        let currentStock = await fetchStockFromDB() // DB取得処理の実装は省略
        cachedStock = currentStock
        return currentStock
    }
}

@MainActor
@Observable
class InventoryViewModel {
    private let repository = StockRepository()
    var stock: Stock?

    func load() async {
        stock = await repository.loadStock()
    }
}
```

上記のコードでは、在庫を表現していたStockが構造体ではなく、class型になりました。
このコードは有効でしょうか。
答えとして、このコードは成り立ちません。なぜなら**isolation boundary**を超えている、Stockは`Sendable`に準拠することができないからです。

ではなぜ、Stockは`Sendable`に準拠できないのでしょうか。
Classは参照型です。そのため、repositoryが返却しているのは、在庫数という数値そのものではなく、Stockインスタンスへの参照です。
たとえば、以下のコードを考えてみましょう。

```swift
class Stock: Sendable {
    var count: Int

    init(count: Int) {
        self.count = count
    }
}

actor StockRepository {
    private var cachedStock: Stock?

    func loadStock() async -> Stock {
        let currentStock = await fetchStockFromDB() // DB取得処理の実装は省略
        cachedStock = currentStock
        return currentStock
    }

    func sell() async {
        // 外部DBの在庫を減らす処理は省略
        cachedStock?.count -= 1
    }
}

@MainActor
func example(_ repository: StockRepository) async {
    let stock = await repository.loadStock()

    Task.detached {
        await repository.sell()
    }

    print(stock.count)
}
```

上記のように、インスタンスへの参照を返してしまうと、repositoryの呼び出し元である`MainActor`の**isolation domain**からrepositoryの**isolation domain**の値を更新できるようになってしまいます。そして`await repository.sell()`、`print(stock.count)`の処理が同時に実行された場合、データ競合が起こってしまいます


では次の例ではどうでしょう。
先ほどの Stock を class のまま、作成後に count を変更できない形にします。

```swift
final class Stock: Sendable {
    let count: Int

    init(count: Int) {
        self.count = count
    }
}

actor StockRepository {
    private var cachedStock: Stock?

    func loadStock() async -> Stock {
        let currentStock = await fetchStockFromDB() // DB取得処理の実装は省略
        cachedStock = currentStock
        return currentStock
    }

    func sell() async -> Stock {
        let updatedCount = await sellStockInDB() // DB更新処理の実装は省略
        let updatedStock = Stock(count: updatedCount)
        cachedStock = updatedStock
        return updatedStock
    }
}

@MainActor
func example(_ repository: StockRepository) async {
    let stock = await repository.loadStock()

    Task.detached {
        _ = await repository.sell()
    }

    print(stock.count)
}
```

このコードは有効です。
Stock は class なので、Repositoryは先ほどと同様にインスタンスへの参照を`MainActor`に渡すことになります。
しかし、Stockの持つcountがvarではなくletとなり、一度作成してから変更できなくなりました。
repositoryはsell関数を持っていますが、その内部では新しいStockのインスタンスを作り、cachedStockを差し替えているため、`MainActor`に共有されたインスタンスに対して変化はありません
そのため、Repositoryのインスタンスが持つ**isolation domain**と`MainActor`の持つ**isolation domain**のどちらからもその値に対して書き込みを行うことができません。
よって、安全に値を共有することができるため、`Sendable`に準拠することができるようになりました。


では、次に、Stock が struct であれば、必ず `Sendable` に準拠できるのでしょうか。
次の例では、Stock は、商品の情報を class の Product として持っています。

```swift
final class Product {
    var name: String

    init(name: String) {
        self.name = name
    }
}

struct Stock {
    var count: Int
    var product: Product
}

actor StockRepository {
    private var cachedStock: Stock?

    func loadStock() async -> Stock {
        let currentStock = await fetchStockFromDB() // DB取得処理の実装は省略
        cachedStock = currentStock
        return currentStock
    }

    func updateProductName() async {
        // 外部DBの商品名を更新する処理は省略
        cachedStock?.product.name = "青りんご"
    }
}

@MainActor
func example(_ repository: StockRepository) async {
    let stock = await repository.loadStock() // 実際にはここでコンパイルエラー

    Task.detached {
        await repository.updateProductName()
    }

    stock.product.name = "赤りんご"
}
```

このコードも有効ではありません。

Stock は struct なので、Repository の cachedStock と `MainActor` が受け取る stock は別々の値です。しかし、それぞれが持つ product は同じ Product インスタンスへの参照です。そのため、cachedStock?.product.name = "青りんご" と stock.product.name = "赤りんご" が同時に実行されると、データ競合が発生します。

このように、Swift Concurrency では、`Sendable` というプロトコルを使って、異なる **isolation domain** 間で値を安全に共有できるかをコンパイル時に検査します。これにより、データ競合を起こしうる値の受け渡しを、実行前に防ぐことができます。