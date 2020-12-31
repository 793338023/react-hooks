## useState

组件的状态分为`mount`与`update`

当执行到这个组件时，处于 render 阶段时 workInProgress 会指向当前 Fiber 树上

fiber.memoizedState：FunctionComponent 对应 fiber 保存的 Hooks 链表。

hook.memoizedState：Hooks 链表中保存的单一 hook 对应的数据。

### useState 如何保存状态

由于函数组件，函数相当于类的 render 方法，每次组件的渲染都会调用函数，利用这个机制，在每次调用组件之前先切换到当前的 fiber

而 fiber 保存了当前组件的所有状态信息，而初始化调用时组件内调用的每个 hook 都会进入 hook 链表里，hook 链表也是单向链表

如 useState 的 初始化挂载时使用获取 hook 的 [mountWorkInProgressHook](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L545) 与 更新时调用的[updateWorkInProgressHook](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L566)

对应模拟代码的

```js
if (isMount) {
  // 挂载时的操作
  hook = {
    queue: {
      pending: null,
    },
    memoizedState: initialState,
    next: null,
  };

  if (!fiber.memoizedState) {
    // 没值把第一个hook挂载在fiber.memoizedState上
    fiber.memoizedState = hook;
  } else {
    // 有，把hook挂载在fiber.memoizedState的下个节点上
    workInProgressHook.next = hook;
  }
  // 更新为当前hook
  workInProgressHook = hook;
} else {
  // 更新时获取当前第一个hook
  hook = workInProgressHook;

  // 指向下一个hook
  workInProgressHook = workInProgressHook.next;
}
```

isMount 代表使用组件初始化加载，在 react 源码中没有那么简单，源码使用[mountState](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L1797)与[updateState](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L1819)进行挂载与更新的调用

而在首次加载时所有的 hook 都会按顺序的挂载在链表上

workInProgressHook 表示当前要执行的 hook，赋值给当前操作的 hook 后指向下一个 hook

从这里可知，如果把 hook 放到判断里，那么 hook 链表就无法保证顺序的可靠性，导致更新时的错乱

如:

```js
function App() {
  const [num, updateNum] = useState(0);
  const [num1, updateNum1] = useState(100);

  useEffect(() => {
    console.log("useEffect1");
  }, []);

  return <div>测试</div>;
}
```

hook 链表如下:

```js
// 当前的fiber
const fiber = {
  memoizedState: {
    queue: {
      pending: null,
    },
    memoizedState: 0,
    next: {
      queue: {
        pending: null,
      },
      memoizedState: 100,
      next: {
        queue: {
          pending: null,
        },
        memoizedState: {
          tag,
          create: () => {
            console.log("useEffect1");
          },
          destroy: undefined,
          deps: [],
          // Circular
          next: null,
        },
        next: null,
      },
    },
  },
  stateNode: App,
};
```

memoizedState 保存当前 hook 的值

### 如何更新状态

在状态更新时会调用[dispatchAction](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L1662)

以下简化`dispatchAction`去理解

```js
function dispatchAction(queue, action) {
  // 更新
  const update = {
    action,
    next: null,
  };

  // 环形链表，保证链头为最新更新更新
  if (queue.pending === null) {
    update.next = update;
  } else {
    update.next = queue.pending.next;
    queue.pending.next = update;
  }

  queue.pending = update;

  schedule();
}
```

update 数据结构，action 为当前需要更新的值或方法，next 指向下一次同一个状态更新的，而更新会放到`ueue.pending`里，形成一个环形链表，好处就是链表的第一个和最后一个是相等，并且第一个为最新的更新调用，这样就可以同一个状态同时更新多个都有在链表里保存并调用

```js
// 获取当前的state
let baseState = hook.memoizedState;

if (hook.queue.pending) {
  // 存在需要更新的状态
  let firstUpdate = hook.queue.pending.next;

  // 遍历环形链表 第一个等于当前时为终结循环
  do {
    const action = firstUpdate.action;
    // 获取最新状态
    baseState = action(baseState);
    firstUpdate = firstUpdate.next;
  } while (firstUpdate !== hook.queue.pending);
  // 清除更新队列
  hook.queue.pending = null;
}

// 保存当前最新状态到state里
hook.memoizedState = baseState;
```
