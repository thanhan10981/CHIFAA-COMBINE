'use client';
import type {InputHTMLAttributes} from 'react';
import {moneyInputValue,parseMoneyInput} from '@/lib/format';
export function CurrencyInput({value,onValueChange,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'>&{value:string;onValueChange:(value:string)=>void}){return <span className="currency-input"><input {...props} type="text" inputMode="decimal" value={moneyInputValue(value)} onChange={event=>{const parsed=parseMoneyInput(event.target.value);if(parsed!==null)onValueChange(parsed);}}/></span>;}
