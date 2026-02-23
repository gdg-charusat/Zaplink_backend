declare module "mammoth" {
    interface ExtractRawTextOptions {
        path?: string;
        buffer?: Buffer;
        arrayBuffer?: ArrayBuffer;
    }

    interface Result {
        value: string;
        messages: Message[];
    }

    interface Message {
        type: string;
        message: string;
        error?: Error;
    }

    interface ConvertToHtmlOptions extends ExtractRawTextOptions {
        styleMap?: string | string[];
        includeDefaultStyleMap?: boolean;
        convertImage?: ImageConverter;
        ignoreEmptyParagraphs?: boolean;
        idPrefix?: string;
    }

    type ImageConverter = (
        image: Image
    ) => Promise<{ src: string;[key: string]: string }>;

    interface Image {
        read(encoding?: string): Promise<Buffer>;
        contentType: string;
        altText?: string;
    }

    export function extractRawText(options: ExtractRawTextOptions): Promise<Result>;
    export function convertToHtml(
        options: ConvertToHtmlOptions,
        config?: object
    ): Promise<Result>;
    export function convertToMarkdown(
        options: ConvertToHtmlOptions,
        config?: object
    ): Promise<Result>;
}
