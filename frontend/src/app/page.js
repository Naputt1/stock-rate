"use client"

import { useState, useEffect } from "react";
import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

const { io } = require("socket.io-client");
const axios = require("axios");

const SERVER_PORT = 3001;

export default function BasicTable() {
  const [data, setData] = useState([]);

  useEffect(() => {
    axios
      .get(`http://localhost:${SERVER_PORT}`)
      .then((response) => {
        console.log(response)
        setData(response.data);
      })
      .catch((error) => {
        console.log(error);
      });

      const socket = io(`ws://localhost:${SERVER_PORT}`);
      socket.on("update", (tData) => {
        console.log(tData);
        setData(tData);
      });
  }, []);


  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>ชื่อย่อหลักทรัพย์</TableCell>
            <TableCell align="right">ราคาล่าสุด</TableCell>
            <TableCell align="right">เปลี่ยนแปลง</TableCell>
            <TableCell align="right">เปลี่ยนแปลง (%)</TableCell>
            <TableCell align="right">
              มูลค่าหลักทรัพย์ตามราคาตลาด (ล้านบาท)
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row.symbol}
              sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
            >
              <TableCell component="th" scope="row">
                {row.symbol}
              </TableCell>
              <TableCell align="right">{row.last}</TableCell>
              <TableCell align="right">{row.change}</TableCell>
              <TableCell align="right">
                {row.percentChange.toFixed(2)}
              </TableCell>
              <TableCell align="right">
                {(row.marketCap / 1000000).toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
