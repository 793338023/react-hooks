## useState

组件的状态分为`mount`与`update`

当执行到这个组件时，处于 render 阶段时 workInProgress 会指向当前 Fiber 树上

fiber.memoizedState：FunctionComponent 对应 fiber 保存的 Hooks 链表。

hook.memoizedState：Hooks 链表中保存的单一 hook 对应的数据。

### useState 如何保存状态

由于函数组件，函数相当于类的 render 方法，每次组件的渲染都会调用函数，利用这个机制，在每次调用组件之前先切换到当前的 fiber

而 fiber 保存了当前组件的所有状态信息，而初始化调用时组件内调用的每个 hook 都会进入 hook 链表里，hook 链表也是单向链表

如 useState 的 初始化挂载时使用获取 hook 的 <a href="https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L545" target="_blank">mountWorkInProgressHook</a>[mountWorkInProgressHook](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L545) 与 更新时调用的[updateWorkInProgressHook](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L566?_blank)

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

isMount 代表使用组件初始化加载，在 react 源码中没有那么简单，源码使用[mountState](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L1797?_blank)与[updateState](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L1819?_blank)进行挂载与更新的调用

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

在状态更新时会调用[dispatchAction](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L1662?_blank)

1. 以下简化`dispatchAction`去理解

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

update 数据结构，action 为当前需要更新的值或方法，next 指向下一次同一个状态更新的，而更新会放到`queue.pending`里，形成一个环形链表，好处就是链表的第一个和最后一个是相等，并且第一个为最新的更新调用，这样就可以同一个状态同时更新多个都有在链表里保存并调用

如:

```
// 第一次
update1->update1
// 第二次
update2->update1->update2
// 第三次
update3->update1->update2->update3
// 第四次
update4->update1->update2->update3->update4
```

因此状态的更新都可以先收集到这里，到后续在更新

2. 简化版[useState](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L710?_blank)状态更新，真实的源码更新比这个复杂，需要考虑的情况比较多，这里这个只能满足了解核心的更新原理

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

当我们触发`setState`时会触发`dispatchAction`把需要更新的状态保存在`hook.queue.pending`里，然后收集批量更新，当然如果状态的更新在异步里，只能立刻更新每个状态，而每次的更新状态都在重新调用组件方法，那么它就可以走`useState`的 update，而更新的大概过程就如上面的简化版

而 hook 的更新在代码效果上也是异步更新，但这是在没有在异步里更新状态情况下，在同步里，调用了`setState`后直接获取最新`state`，是不可能的，获取的是旧值

个人经验所得，如果涉及到界面的状态更新就用`useState`，否则可以考虑使用`useRef`，这样就可以实时获取到最新的更新值

## useReducer

useState 的实现与 useReducer 是差不多的，mountReducer 与 mountState 的实现逻辑是类似的，而 updateState 的内部处理部分逻辑后直接调用 updateReducer 来实现状态的更新

所以大致可以认为 useState 的实现就是基于 useReducer

## useEffect

useEffect 第一个参数函数是异步调用的，在组件渲染后，而使用的异步的方式是[MessageChannel](https://developer.mozilla.org/zh-CN/docs/Web/API/MessageChannel?_blank)

Channel Messaging API 的 MessageChannel 接口允许我们创建一个新的消息通道，并通过它的两个 MessagePort 属性发送数据。

而 useEffect 的里的第一个参数的函数返回值会在每次执行前执行一次，主要的目前在里面进行清除上一次操作的副作用，如定时器

memoizedState 保存包含 useEffect 回调函数、依赖项等的链表数据结构[effect](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L1181?_blank)

effect 链表同时会保存在 fiber.updateQueue 中

了解下 useEffect 在`postMessage`异步后的工作原理

1. 执行[flushPassiveEffects](https://github.com/facebook/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2458?_blank)设置优先级，然后再执行[flushPassiveEffectsImpl](https://github.com/facebook/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2532?_blank)

2. `flushPassiveEffectsImpl`内部会根据[pendingPassiveHookEffectsUnmount](https://github.com/facebook/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2573?_blank)先调用所有待处理的被动效果销毁函数`destroy`，在调用任何被动效果创建函数`create`之前，否则，同级组件中的效果可能会相互干扰。例如 一个组件中的 destroy 函数可能会无意中覆盖 ref，由另一个组件中的 create 函数设置的值。useLayoutEffect 具有相同的约束效果，所以第一件事就是调用所有的销毁函数。

3. `flushPassiveEffectsImpl`在调用完销毁函数`destroy`后就会根据[pendingPassiveHookEffectsMount](https://github.com/facebook/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2633?_blank)遍历执行对应 effect 的回调函数`create`。

4. 总结:
   而 useEffect 会先调用所有的销毁函数，然后再顺序调用所有副作用函数

## useLayoutEffect

useLayoutEffect 与 useEffect 差不多，但它没有异步调用，而是组件渲染后直接同步调用

## useRef

也分为[mountRef](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L1208?_blank)与[updateRef](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L1218?_blank)，但这个就简单很多了

就一个`{current: initialValue}`结构，所以我们每次使用时都要`xxx.current`对它赋值，利用对象引入关系进行储存数据，所以它不会更新视图，但能实时保存数据

而 update 时直接从 updateWorkInProgressHook 里获取到 hook 把 hook.memoizedState 返回。

如:

```js
const aaa = useRef(1);

aaa.current = 222;
```

## useMemo

[mountMemo](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L1427?_blank)与[updateMemo](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L1438?_blank)，hook 都会调用 mountWorkInProgressHook 与 updateWorkInProgressHook 获取当前 hook，而 useMemo 的实现很简单，就是把传入的第一个参数的函数返回值与第二参数依赖项保存在 hook 的 memoizedState 里，然后 useMemo 返回当前的 nextValue，而更新时会先比较依赖项是否有变化，有重新调用第一个参数的函数，没有变化就返回 hook.memoizedState 的值，而依赖项的比较使用的是`Object.is`API

源码:

```js
hook.memoizedState = [nextValue, nextDeps];
```

## useCallback

它的实现与 useMemo 差不多，只是保存在 memoizedState 的第一个值是 callback

```js
hook.memoizedState = [callback, nextDeps];
```

## 总结

基本所有的 hook 的值都会保存在 memoizedState 里，但有些是没有 memoizedState 的，如 useContext

而获取的当前 hook 都会调用 [mountWorkInProgressHook](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L545?_blank) 与 [updateWorkInProgressHook](https://github.com/acdlite/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberHooks.new.js#L566?_blank)，分别对应挂载时与更新时的调用

而以上的 hook 已经满足大部分开发要求了，就算有新的 hook 出现，差不多也是基于以上的能力进行组装的

[实验例子](./src/App.js)
[简单版 hook](./src/HookTest.js)
