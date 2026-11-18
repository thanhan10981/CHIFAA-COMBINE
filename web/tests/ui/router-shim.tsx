import {createElement,type AnchorHTMLAttributes,type ReactNode} from 'react';
export function usePathname(){return window.location.pathname;}
export default function Link({href,children,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{href:string;children?:ReactNode}){return <a href={href} {...props}>{children}</a>;}
export function Image({priority,...props}:{src:string;alt:string;width?:number;height?:number;className?:string;priority?:boolean}){void priority;return createElement('img',props);}

export function useSearchParams(){return new URLSearchParams(window.location.search);}
