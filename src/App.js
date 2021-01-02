import React, { useEffect, useLayoutEffect } from "react";
import logo from "./logo.svg";
import "./HookTest";
import "./App.css";

function App() {
  const [val, setval] = React.useState("1");

  useEffect(() => {
    console.log("eee1");
    return () => {
      console.log("destroy1 ->useEffect");
    };
  }, [val]);

  useEffect(() => {
    console.log("aaa2");
    return () => {
      console.log("destroy2 ->useEffect");
    };
  }, [val]);

  useEffect(() => {
    console.log("ccc3");
    return () => {
      console.log("destroy3 ->useEffect");
    };
  }, [val]);
  
  useEffect(() => {
    console.log("xxx4");
    return () => {
      console.log("destroy4 ->useEffect");
    };
  }, [val]);

  // useLayoutEffect(()=>{
  //   console.log("useLayoutEffect");

  // },[])

  async function click() {
    // await 1;
    setval("12");
    setval("123");
    setval("1234");
  }
  console.log(val, "val");
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p onClick={click}>{val}</p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
