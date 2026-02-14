import JSONBig from 'json-bigint';

export const jsonParser = JSONBig({
	useNativeBigInt: true,
	alwaysParseAsBig: false,
});
