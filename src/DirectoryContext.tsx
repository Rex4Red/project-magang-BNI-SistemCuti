import {createContext,useContext} from 'react';
import {POSITIONS,type PositionDefinition} from '../shared/domain';
export const DirectoryContext=createContext<readonly PositionDefinition[]>(POSITIONS);
export function useDirectory(){const positions=useContext(DirectoryContext);return {positions,positionLabel:(code:string)=>positions.find(p=>p[0]===code)?.[1]??code};}
