---
title: クイズ
description: Swift Concurrencyの理解をコードで確かめる
---

このページでは、Swift Concurrencyに関するコードを読み、コンパイル可否、実行時の振る舞い、設計上の危険をしていただきます。
答えを開く前に、「このままでよいか」「問題があるならどこか」「どう直すか」を考えてください。

## Q1. ImageLoaderの実装をレビューする

次の実装は、キャッシュがあればそれを返し、なければネットワークから画像を読み込む想定です。
この実装をレビューしてください。

```swift
final class ImageLoader {
    private var cache: [URL: UIImage] = [:]

    func load(
        from url: URL,
        completion: @escaping (UIImage?) -> Void
    ) {
        if let image = cache[url] {
            completion(image)
        }

        URLSession.shared.dataTask(with: url) { data, _, _ in // URLから画像データを取得する処理
            guard
                let data,
                let image = UIImage(data: data)
            else {
                completion(nil)
                return
            }

            self.cache[url] = image
            completion(image)
        }.resume()
    }
}
```

<details>
<summary>答え</summary>

キャッシュに画像がある場合でも、完了ハンドラが2回呼ばれる可能性があります。

`if let image = cache[url]` の中で `completion(image)` を呼んだあと、そのままネットワーク処理へ進んでいます。
キャッシュヒットで処理を終えたいなら、`return` が必要です。

```swift
if let image = cache[url] {
    completion(image)
    return
}
```

さらに、この実装では `cache` を複数のスレッドから触る可能性もあります。
たとえば、同じ `ImageLoader` インスタンスを複数の場所から同時に使うと、どちらの処理も同じ `cache` を読み書きします。

```swift
let loader = ImageLoader()

DispatchQueue.global().async {
    loader.load(from: url) { image in
        print("A:", image as Any)
    }
}

DispatchQueue.global().async {
    loader.load(from: url) { image in
        print("B:", image as Any)
    }
}
```

この場合、二つの `load` が並行に実行される可能性があります。
一方が `cache[url]` を読んでいる間に、もう一方が `self.cache[url] = image` で書き込むかもしれません。
そのため、データ競合が発生する可能性があります。

たとえば、actorでキャッシュを管理し、`async` 関数として表すなら次のように書けます。

```swift
actor ImageLoader {
    private var cache: [URL: UIImage] = [:]

    func load(from url: URL) async throws -> UIImage {
        if let image = cache[url] {
            return image
        }

        let (data, _) = try await URLSession.shared.data(from: url)

        guard let image = UIImage(data: data) else {
            throw ImageError.invalidData
        }

        cache[url] = image
        return image
    }
}
```

</details>

## Q2. legacy APIのasync変換をレビューする

完了ハンドラ方式のAPIを `async` 関数へ変換しています。
この変換が正しくできているかをレビューしてください。

```swift
func readUser(id: String) async throws -> User {
    try await withCheckedThrowingContinuation { continuation in
        loadUser(id: id) { user, error in // ユーザー情報を取得する関数。
            if let user {
                continuation.resume(returning: user)
            }

            if let error {
                continuation.resume(throwing: error)
            }
        }
    }
}
```

<details>
<summary>答え</summary>

安全ではありません。

`withCheckedThrowingContinuation` のcontinuationは、必ず1回だけresumeする必要があります。
このコードには問題が二つあります。

- `user` と `error` の両方が存在すると、2回resumeする
- `user` も `error` も存在しないと、1回もresumeしない

分岐を排他的にし、想定外の状態でも必ずresumeする必要があります。

```swift
func readUser(id: String) async throws -> User {
    try await withCheckedThrowingContinuation { continuation in
        legacyReadUser(id: id) { user, error in
            if let user {
                continuation.resume(returning: user)
            } else if let error {
                continuation.resume(throwing: error)
            } else {
                continuation.resume(throwing: UserError.notFound)
            }
        }
    }
}
```

</details>

## Q3. URLSessionのasync変換をレビューする

次のコードでは、`URLSession` の完了ハンドラを `async throws` に変換しています。
この変換が正しくできているかをレビューしてください。

```swift
enum ImageError: Error {
    case invalidData
}

func loadImage(from url: URL) async throws -> UIImage {
    try await withCheckedThrowingContinuation { continuation in
        URLSession.shared.dataTask(with: url) { data, _, error in
            if let error {
                continuation.resume(throwing: error)
                return
            }

            guard
                let data,
                let image = UIImage(data: data)
            else {
                continuation.resume(throwing: ImageError.invalidData)
                return
            }

            continuation.resume(returning: image)
        }.resume()
    }
}

```

<details>
<summary>答え</summary>

このコードでは、continuationの使い方としては大きな問題はありません。

各分岐で `resume` したあとに `return` しているため、1回のコールバックに対して複数回 `resume` しない構造になっています。
また、エラー、データ不正、成功のどの経路でも必ず `resume` しています。

この問題では、提示された実装の形で問題ありません。

</details>

## Q4. Wallet actorの引き出し処理をレビューする

次の実装は、財布を表したアクターで、残高が足りる場合だけ引き出し処理を行うことができる関数を持っています。
この実装の挙動と安全性をレビューしてください。

```swift
actor Wallet {
    private var balance = 100 // 残高

    func withdraw(_ amount: Int) async -> Bool { // 残高引き出し処理
        guard balance >= amount else {
            return false
        }

        await sendWithdrawalLog(amount) // 外部サービスへ引き出しログを送信

        balance -= amount
        return true
    }
}
```

<details>
<summary>答え</summary>

この実装では、残高の整合性を保てない可能性があります。

actorは同時に一つの処理だけを実行しますが、`await` で中断している間、同じactorの別の処理が進むことがあります。
これをactorの再入可能性と呼びます。

このコードでは、`balance >= amount` を確認したあとに `await sendWithdrawalLog(amount)` で中断しています。
その間に別の `withdraw(80)` が同じ確認を通過すると、どちらも引き出し可能と判断してしまいます。

たとえば、次のように二つのTaskが同じ `Wallet` に対して引き出しを行う場面です。

```swift
let wallet = Wallet()

async let first = wallet.withdraw(80)
async let second = wallet.withdraw(80)

let results = await (first, second)
print(results)
```

実行順によっては、次のように進みます。

1. `first` が `balance >= 80` を確認する。残高は `100` なので通過する。
2. `first` が `await sendWithdrawalLog(80)` で中断する。
3. `second` が `balance >= 80` を確認する。まだ残高は `100` なので通過する。
4. `second` が再開して `balance -= 80` を実行する。残高は `20` になる。
5. `first` が再開して `balance -= 80` を実行する。残高は `-60` になる。

確認と更新を `await` の前にまとめると、残高不足を防ぎやすくなります。

```swift
func withdraw(_ amount: Int) async -> Bool {
    guard balance >= amount else {
        return false
    }

    balance -= amount
    await sendWithdrawalLog(amount)
    return true
}
```

ただし、記録処理に失敗したときの扱いは別途設計が必要です。

</details>

## Q5. MainActor上のViewModel更新をレビューする

`SearchViewModel` は `@MainActor` に隔離されています。
次の二つのメソッドが、それぞれ正しく `text` を更新できるかレビューしてください。

```swift
@MainActor
final class SearchViewModel {
    var text = ""

    func updateWithTask() {
        Task {
            text = "done"
        }
    }

    func updateWithDetachedTask() {
        Task.detached {
            text = "done"
        }
    }
}
```

<details>
<summary>答え</summary>

結論として、`updateWithTask()` は問題ありません。
一方、`updateWithDetachedTask()` はこのままでは問題があります。

`updateWithTask()` は、`Task` のクロージャが現在のactor contextを引き継ぐため、`MainActor` 上で `text` を更新できます。

一方、`Task.detached` は現在のactor contextを引き継ぎません。
`text` は `MainActor` に隔離されているため、detached taskから直接更新できません。

修正するなら、`Task.detached` の中から `MainActor` に戻して更新します。

```swift
@MainActor
final class SearchViewModel {
    var text = ""

    func updateWithTask() {
        Task {
            text = "done"
        }
    }

    func updateWithDetachedTask() {
        Task.detached {
            await MainActor.run {
                self.text = "done"
            }
        }
    }
}
```

</details>

## Q6. `CartItem` クラスをレビューする

`CartItem` を別のTaskやactorへ渡せる値として扱いたいとします。
次の型定義がその目的に合っているかレビューしてください。

```swift
final class Product {
    var name: String

    init(name: String) {
        self.name = name
    }
}

struct CartItem: Sendable {
    var product: Product
    var count: Int
}
```

<details>
<summary>答え</summary>

成立しません。

`CartItem` 自体は値型ですが、中に `Product` という参照型を持っています。
しかも `Product.name` は `var` です。

`CartItem` をコピーして別のisolation domainへ渡しても、内部の `product` は同じインスタンスを指す可能性があります。
その `name` を複数の場所から書き換えられるなら、安全に送れる値とは言えません。

`Product` を値型にする、または作成後に変更できない参照型にするなどの設計が必要です。

値型として表すなら、次のようにできます。

```swift
struct Product: Sendable {
    let name: String
}

struct CartItem: Sendable {
    let product: Product
    let count: Int
}
```

参照型のままにする場合でも、共有後に変更できない形にします。

```swift
final class Product: Sendable {
    let name: String

    init(name: String) {
        self.name = name
    }
}
```

</details>

## Q7. 値型だけで構成された `CartItem` をレビューする

Q6とは違い、`Product` も値型で、すべてのプロパティが `let` です。
次の型定義が別のTaskやactorへ渡せる形になっているかレビューしてください。

```swift
struct Product: Sendable {
    let name: String
}

struct CartItem: Sendable {
    let product: Product
    let count: Int
}
```

<details>
<summary>答え</summary>

成立します。

`Product` も `CartItem` も値型で、保持している値も `String` と `Int` です。
どちらもisolation boundaryを越えて渡しても、同じ可変状態を共有する形になりません。

このコードでは、`CartItem` を別のTaskやactorへ渡しても、渡された側が元の値を直接書き換えることはできません。

この問題では、提示された実装をそのまま使えます。

</details>

## Q8. `@unchecked Sendable` を付けたCounterをレビューする

次の `Counter` は `@unchecked Sendable` に準拠しています。
この実装を複数のTaskから使ってよいかレビューしてください。

```swift
final class Counter: @unchecked Sendable {
    var value = 0
}

let counter = Counter()

Task.detached {
    counter.value += 1
}

Task.detached {
    counter.value += 1
}
```

<details>
<summary>答え</summary>

`@unchecked Sendable` は、コンパイラによる安全性の確認を開発者が引き受ける指定です。

この `Counter` は可変な `value` を持つ参照型ですが、ロックやactorなどで保護されていません。
そのため、二つのTaskから同じ `value` を同時に書き換えるデータ競合が起こりえます。

たとえば、次の二つのTaskは同じ `counter` インスタンスを共有しています。

```swift
let counter = Counter()

Task.detached {
    counter.value += 1
}

Task.detached {
    counter.value += 1
}
```

`counter.value += 1` は、一つの操作に見えますが、内部では値を読み、1を足し、書き戻します。
実行順によっては次のようになります。

1. 1つ目のTaskが `value` を読む。値は `0`。
2. 2つ目のTaskも `value` を読む。値はまだ `0`。
3. 1つ目のTaskが `1` を書き戻す。
4. 2つ目のTaskも `1` を書き戻す。

二回インクリメントしたつもりでも、最終結果が `2` ではなく `1` になる可能性があります。

`@unchecked Sendable` を付けることは、データ競合がなくなることではありません。
コンパイラの警告やエラーを抑えるだけで、実際の同期は開発者が実装する必要があります。

安全にしたいなら、actorとして状態を隔離する方法があります。

```swift
actor Counter {
    private var value = 0

    func increment() {
        value += 1
    }

    func currentValue() -> Int {
        value
    }
}
```

参照型のままにするなら、ロックなどで全アクセスを保護する必要があります。

</details>

## Q9. 並行に開始したLogger操作をレビューする

次のコードで、`messages` の内容と順序がどうなるかレビューしてください。

```swift
actor Logger {
    private var messages: [String] = []

    func append(_ message: String) {
        messages.append(message)
    }

    func dump() -> [String] {
        messages
    }
}

let logger = Logger()

async let a: Void = logger.append("A")
async let b: Void = logger.append("B")

_ = await (a, b)
let messages = await logger.dump()
```

<details>
<summary>答え</summary>

必ず `["A", "B"]` になるとは限りません。

actorによって `messages` へのデータ競合は防がれます。
しかし、`async let` で開始した二つの処理の実行順は固定されていません。

そのため、結果は `["A", "B"]` になることもあれば、`["B", "A"]` になることもあります。

これはデータ競合ではありません。
順番に意味があるなら、並行に開始せず、順番に `await` して呼び出す必要があります。

```swift
await logger.append("A")
await logger.append("B")

let messages = await logger.dump()
```

</details>

## Q10. 逐次実行したLogger操作をレビューする

次のコードで、`messages` の内容と順序がどうなるかレビューしてください。

```swift
actor Logger {
    private var messages: [String] = []

    func append(_ message: String) {
        messages.append(message)
    }

    func dump() -> [String] {
        messages
    }
}

let logger = Logger()

await logger.append("A")
await logger.append("B")

let messages = await logger.dump()
```

<details>
<summary>答え</summary>

このコードでは、`messages` は `["A", "B"]` になります。

`append("A")` を `await` して完了を待ってから、次に `append("B")` を呼んでいます。
二つの処理を並行に開始していないため、呼び出し順が保たれます。

actorはデータ競合を防ぎます。
それに加えて、このコードでは呼び出し側が逐次的に `await` しているため、順番も固定されています。

この問題では、提示された実装で順序を保てています。

</details>

## Q11. Accountの表示用データ取得をレビューする

画面に「残高」と「ポイント」を同時に表示したいとします。
表示に使う値は、同じ時点の `balance` と `point` の組み合わせである必要があります。
次の二つの実装をレビューしてください。

```swift
actor Account {
    var balance = 0
    var point = 0

    func earnPoint(_ value: Int) {
        point += value
    }
}

func snapshotA(_ account: Account) async -> (Int, Int) {
    let balance = await account.balance
    let point = await account.point
    return (balance, point)
}

func snapshotB(_ account: isolated Account) -> (Int, Int) {
    let balance = account.balance
    let point = account.point
    return (balance, point)
}
```

<details>
<summary>答え</summary>

`snapshotA` は、`balance` と `point` を別々に `await` して読みます。
その間に別の処理が `account` に入り、二つの値の組み合わせが途中状態になる可能性があります。

たとえば、`snapshotA(account)` を実行している最中に、別のTaskが `earnPoint` を呼ぶ場面です。

```swift
let account = Account()

async let snapshot = snapshotA(account)

Task {
    await account.earnPoint(100)
}

let result = await snapshot
```

実行順によっては、内部では次のように進みます。

1. `snapshotA` が `let balance = await account.balance` で `balance` を読む。
2. 別のTaskが `await account.earnPoint(100)` を実行し、`point` を更新する。
3. `snapshotA` が `let point = await account.point` で `point` を読む。

この場合、`balance` はポイント更新前の値、`point` はポイント更新後の値になります。
二つの値はそれぞれ正しく読めていますが、同じ時点の組み合わせではありません。

`snapshotB` は、関数本体が `account` のisolation domainの中で実行されます。
そのため、関数内では `await` なしで二つの値を読み、ひとまとまりの処理として扱えます。

`isolated` 引数は、単に `await` を省略するためだけではなく、複数のactor隔離状態を一つの処理として扱いやすくします。

スナップショットとして使いたいなら、`isolated` 引数を使うか、actor自身のメソッドとして定義します。

```swift
extension Account {
    func snapshot() -> (Int, Int) {
        (balance, point)
    }
}
```

</details>

## Q12. ArticleStoreの `nonisolated` メソッドをレビューする

`title()` をactorの外から同期的に呼べるようにしたいとします。
次の実装が成立するかレビューしてください。

```swift
actor ArticleStore {
    let category = "Swift"
    var articles: [Article] = []

    nonisolated func title() -> String {
        "\(category): \(articles.count)"
    }
}
```

<details>
<summary>答え</summary>

この形では `nonisolated` にできません。

`articles` はactorに隔離された可変状態です。
`nonisolated` メソッドはactorのisolation domainの外にあるため、`articles.count` を同期的に読むことはできません。

一方、隔離された可変状態に触らない実装なら `nonisolated` にできます。

```swift
nonisolated func staticTitle() -> String {
    "Articles"
}
```

ただし、何を同期的に外へ公開してよいかは、プロパティの可変性やアクセス制御も含めて慎重に判断する必要があります。

</details>

## Q13. detached taskからのUI更新をレビューする

`ProfileViewModel.name` は `@MainActor` に隔離されています。
次の実装で、`name` の更新が適切なisolation上で行われているかレビューしてください。

```swift
@MainActor
final class ProfileViewModel {
    var name = "読み込み中"

    func load() {
        Task.detached {
            let loadedName = await fetchName()

            await MainActor.run {
                self.name = loadedName
            }
        }
    }
}
```

<details>
<summary>答え</summary>

このコードでは、`name` の更新は `MainActor` 上で行われています。

`Task.detached` は `MainActor` のcontextを引き継ぎません。
しかし、`await MainActor.run { ... }` の中で `self.name` を更新しているため、`@MainActor` に隔離された状態へ戻ってから代入しています。

`loadedName` は `String` なので、`MainActor` へ渡しても問題になりにくい値です。

この問題では、提示された実装の形で `MainActor` へ戻せています。

</details>

## Q14. Sessionをdetached taskへ渡す実装をレビューする

次のコードをSwift 6 language modeでコンパイルすると、concurrency関連の診断で問題になりやすい箇所があります。
この設計のどこが危険かレビューしてください。

```swift
final class Session {
    var token: String?
}

func refresh(_ session: Session) {
    Task.detached {
        session.token = await fetchToken()
    }
}
```

<details>
<summary>答え</summary>

`Session` は可変状態を持つ参照型です。
それを `Task.detached` に渡し、別の並行処理から `token` を変更しています。

たとえば、同じ `Session` インスタンスを、更新処理と読み取り処理が共有する場面です。

```swift
let session = Session()

refresh(session)

Task.detached {
    print(session.token as Any)
}
```

このとき、`refresh(session)` の中では別Taskが `session.token` を書き換えます。
一方で、下の `Task.detached` は同じ `session.token` を読み取ります。

実行順によっては、次のように読み書きが重なります。

1. `refresh(session)` が `Task.detached` を開始する。
2. そのTaskが `session.token = await fetchToken()` で `token` を書き換える。
3. 別のTaskが `print(session.token as Any)` で同じ `token` を読む。

同じ参照型インスタンスの可変プロパティを、複数の並行処理から直接触っている点が問題です。

Swift 6 language modeでは、このようにデータ競合につながるコードの多くが、警告ではなくコンパイルエラーとして扱われます。

設計としては、たとえば `Session` をactorにする、`token` 更新を `@MainActor` など特定のisolation domainへ隔離する、値を直接共有しない形にする、といった選択肢があります。

たとえば、`Session` をactorにすると、`token` の更新を `Session` のisolation domainに閉じ込められます。

```swift
actor Session {
    private var token: String?

    func refresh() async {
        token = await fetchToken()
    }

    func currentToken() -> String? {
        token
    }
}
```

</details>

## Q15. Swiftコンパイラと言語モードの設定をレビューする

次の二つの出力とコマンドを見て、コンパイラのバージョン、language mode、strict concurrency checkingの状態をレビューしてください。

```text
swiftc --version
Apple Swift version 6.0
```

```text
swiftc -swift-version 5 -strict-concurrency=complete main.swift
```

<details>
<summary>答え</summary>

Swift 6 language modeではありません。

使っているコンパイラはSwift 6に対応しています。
しかし、ビルドコマンドでは `-swift-version 5` を指定しているため、language modeはSwift 5です。

同時に、`-strict-concurrency=complete` によってstrict concurrency checkingを有効にしています。
つまり、Swift 5 language modeのまま、Swift 6 language modeへ移行する前にconcurrency関連の問題を見つけようとしている状態です。

Swift 6 language modeでコンパイルしたい場合は、たとえば次のように指定します。

```text
swiftc -swift-version 6 main.swift
```

</details>
