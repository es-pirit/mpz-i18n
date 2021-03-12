declare type Index = string | number;
declare type Primitive = Index | boolean;
declare type LiteralBoolean = "false" | "true";
declare type Empty = void | null | undefined;

declare type Dict<T = any> = Record<Index, T>;
declare type Extension<K extends Index, T = any> = Record<K | Index, T>;

declare type PartialDict<T = any> = Partial<Dict<T>>;
declare type PartialRecord<K extends Index, T = any> = Partial<Record<K, T>>;
declare type PartialExtension<K extends Index, T = any> = Partial<Extension<K, T>>;

declare type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

declare type Writable<T> = {
    -readonly [P in keyof T]: T[P];
};
declare type DeepWritable<T> = {
    -readonly [P in keyof T]: DeepWritable<T[P]>
};
declare type DeepReadonly<T> = {
    readonly [P in keyof T]: DeepReadonly<T[P]>;
};

declare type Merge<T, U> = Omit<T, keyof U> & U;

declare type Enum = {
    [key: string]: Index,
    [key: number]: string,
};
declare type StringEnum = {
    [key: string]: string,
}
