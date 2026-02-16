# @embedly/platforms

## 0.12.2

### Patch Changes

- [#46](https://github.com/embed-team/embedly/pull/46) [`44d558f`](https://github.com/embed-team/embedly/commit/44d558ff10ae62d2698ac1215c253cdd05905d79) Thanks [@ItsRauf](https://github.com/ItsRauf)! - use gif.fxtwitter.com for twitter gif media URLs

- Updated dependencies []:
  - @embedly/builder@0.12.2
  - @embedly/logging@0.12.2

## 0.12.1

### Patch Changes

- Updated dependencies []:
  - @embedly/builder@0.12.1
  - @embedly/logging@0.12.1

## 0.12.0

### Minor Changes

- [#42](https://github.com/embed-team/embedly/pull/42) [`5cdbcd7`](https://github.com/embed-team/embedly/commit/5cdbcd7f3fd957473b0ee00ca824fe6b2bcce1f7) Thanks [@ItsRauf](https://github.com/ItsRauf)! - Harden platform error handling, add messageDelete listener for automatic embed cleanup, and remove unnecessary comments

- [#42](https://github.com/embed-team/embedly/pull/42) [`b526829`](https://github.com/embed-team/embedly/commit/b52682924a0eb926de98695145915c3fa0cf9444) Thanks [@ItsRauf](https://github.com/ItsRauf)! - refactored a bunch of the code surrounding types and parsing

- [#42](https://github.com/embed-team/embedly/pull/42) [`14aa4d0`](https://github.com/embed-team/embedly/commit/14aa4d0f611ec5142271347529819cef5f853de6) Thanks [@ItsRauf](https://github.com/ItsRauf)! - Replace BetterStack (Logtail) with OTEL-native logging for LGTM stack. Logs now flow through OpenTelemetry to Loki alongside traces and metrics. Added EmbedlyLogger class, platform and source labels for Grafana indexing, and trace correlation for the API.

### Patch Changes

- Updated dependencies [[`5cdbcd7`](https://github.com/embed-team/embedly/commit/5cdbcd7f3fd957473b0ee00ca824fe6b2bcce1f7), [`b526829`](https://github.com/embed-team/embedly/commit/b52682924a0eb926de98695145915c3fa0cf9444), [`4b6f900`](https://github.com/embed-team/embedly/commit/4b6f900d9f483fcc01c817c8071d49904f94a9a7), [`14aa4d0`](https://github.com/embed-team/embedly/commit/14aa4d0f611ec5142271347529819cef5f853de6)]:
  - @embedly/builder@0.12.0
  - @embedly/logging@0.12.0

## 0.11.0

### Minor Changes

- [#39](https://github.com/embed-team/embedly/pull/39) [`90c90a9`](https://github.com/embed-team/embedly/commit/90c90a943139d7616d7ea1a70c96a907518bbacc) Thanks [@ItsRauf](https://github.com/ItsRauf)! - added reddit support (mostly working)

### Patch Changes

- Updated dependencies []:
  - @embedly/builder@0.11.0
  - @embedly/logging@0.11.0
  - @embedly/parser@0.11.0
  - @embedly/types@0.11.0

## 0.10.0

### Patch Changes

- [#36](https://github.com/embed-team/embedly/pull/36) [`dde5d23`](https://github.com/embed-team/embedly/commit/dde5d23d2d3705dc743fb772d602f64d85069f8c) Thanks [@ItsRauf](https://github.com/ItsRauf)! - feat(ci): split github actions across multiple files

- Updated dependencies [[`487a6e0`](https://github.com/embed-team/embedly/commit/487a6e0503852868c403119011f8be2afa392be7), [`dde5d23`](https://github.com/embed-team/embedly/commit/dde5d23d2d3705dc743fb772d602f64d85069f8c)]:
  - @embedly/builder@0.10.0
  - @embedly/logging@0.10.0
  - @embedly/parser@0.10.0
  - @embedly/types@0.10.0

## 0.9.1

### Patch Changes

- [#34](https://github.com/embed-team/embedly/pull/34) [`d8495b4`](https://github.com/embed-team/embedly/commit/d8495b40953bce13cb528dfb28f467cdbf19d07c) Thanks [@ItsRauf](https://github.com/ItsRauf)! - feat(ci): split github actions across multiple files

- Updated dependencies [[`d8495b4`](https://github.com/embed-team/embedly/commit/d8495b40953bce13cb528dfb28f467cdbf19d07c)]:
  - @embedly/builder@0.9.1
  - @embedly/logging@0.9.1
  - @embedly/parser@0.9.1
  - @embedly/types@0.9.1

## 0.9.0

### Patch Changes

- Updated dependencies [[`0c800a2`](https://github.com/embed-team/embedly/commit/0c800a2311bce62641b5a9112124851b506c428f)]:
  - @embedly/logging@0.9.0
  - @embedly/builder@0.9.0
  - @embedly/parser@0.9.0
  - @embedly/types@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [[`4e750fa`](https://github.com/embed-team/embedly/commit/4e750fa420323f6da0871603941e8c6c0643d9c5), [`9c5c80d`](https://github.com/embed-team/embedly/commit/9c5c80d3015bcee08027856d919283f8a7cd916c)]:
  - @embedly/builder@0.8.0
  - @embedly/parser@0.8.0
  - @embedly/logging@0.8.0
  - @embedly/types@0.8.0

## 0.7.1

### Patch Changes

- [#26](https://github.com/embed-team/embedly/pull/26) [`6f40601`](https://github.com/embed-team/embedly/commit/6f40601e86b5b2a7956e3ada83725b2cc9635018) Thanks [@ItsRauf](https://github.com/ItsRauf)! - twitter replies showing incorrect parent media

- Updated dependencies [[`6f40601`](https://github.com/embed-team/embedly/commit/6f40601e86b5b2a7956e3ada83725b2cc9635018)]:
  - @embedly/builder@0.7.1
  - @embedly/logging@0.7.1
  - @embedly/parser@0.7.1
  - @embedly/types@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies [[`2499c4e`](https://github.com/embed-team/embedly/commit/2499c4e1edbf46312b99398e181518477aee44fe), [`03ba719`](https://github.com/embed-team/embedly/commit/03ba7192385dbb588611e204b9dba957f1081e53)]:
  - @embedly/builder@0.7.0
  - @embedly/logging@0.7.0
  - @embedly/parser@0.7.0
  - @embedly/types@0.7.0

## 0.6.0

### Minor Changes

- [#22](https://github.com/embed-team/embedly/pull/22) [`327acfe`](https://github.com/embed-team/embedly/commit/327acfe0c405fd57b65643e881bd4978af47e0bb) Thanks [@ItsRauf](https://github.com/ItsRauf)! - refactor embed builder and fix delete command

### Patch Changes

- [#22](https://github.com/embed-team/embedly/pull/22) [`327acfe`](https://github.com/embed-team/embedly/commit/327acfe0c405fd57b65643e881bd4978af47e0bb) Thanks [@ItsRauf](https://github.com/ItsRauf)! - replies now show in the correct order

- Updated dependencies [[`327acfe`](https://github.com/embed-team/embedly/commit/327acfe0c405fd57b65643e881bd4978af47e0bb), [`327acfe`](https://github.com/embed-team/embedly/commit/327acfe0c405fd57b65643e881bd4978af47e0bb)]:
  - @embedly/builder@0.6.0
  - @embedly/logging@0.6.0
  - @embedly/parser@0.6.0
  - @embedly/types@0.6.0

## 0.5.3

### Patch Changes

- [#20](https://github.com/embed-team/embedly/pull/20) [`455d9b1`](https://github.com/embed-team/embedly/commit/455d9b19b0c8662a85799557fedd8b9bfae2cc33) Thanks [@ItsRauf](https://github.com/ItsRauf)! - sane spoiler and escape detection

- Updated dependencies [[`455d9b1`](https://github.com/embed-team/embedly/commit/455d9b19b0c8662a85799557fedd8b9bfae2cc33)]:
  - @embedly/builder@0.5.3
  - @embedly/logging@0.5.3
  - @embedly/parser@0.5.3
  - @embedly/types@0.5.3

## 0.5.2

### Patch Changes

- [#12](https://github.com/embed-team/embedly/pull/12) [`f035200`](https://github.com/embed-team/embedly/commit/f0352002441303e8dc02ec5fe19a8a2b55621e81) Thanks [@ItsRauf](https://github.com/ItsRauf)! - fixed twitter replies bubbling to top of thread

- Updated dependencies []:
  - @embedly/builder@0.5.2
  - @embedly/logging@0.5.2
  - @embedly/parser@0.5.2
  - @embedly/types@0.5.2

## 0.5.1

### Patch Changes

- [#12](https://github.com/embed-team/embedly/pull/12) [`1097443`](https://github.com/embed-team/embedly/commit/1097443312b448010388135a559e6ffe6102e282) Thanks [@ItsRauf](https://github.com/ItsRauf)! - fixed twitter replies bubbling to top of thread

- Updated dependencies []:
  - @embedly/builder@0.5.1
  - @embedly/logging@0.5.1
  - @embedly/parser@0.5.1
  - @embedly/types@0.5.1

## 0.5.0

### Minor Changes

- [#10](https://github.com/embed-team/embedly/pull/10) [`fc21052`](https://github.com/embed-team/embedly/commit/fc21052b89e65f5fd4d6a2dcdda4179516ca81e6) Thanks [@ItsRauf](https://github.com/ItsRauf)! - added 'Delete Embeds' command and cleaned up error messages

### Patch Changes

- [#10](https://github.com/embed-team/embedly/pull/10) [`e7731c4`](https://github.com/embed-team/embedly/commit/e7731c49c211603f1421c6bb57efb0c9ac9ea9a7) Thanks [@ItsRauf](https://github.com/ItsRauf)! - fixed threads media parsing throwing errors

- Updated dependencies [[`fc21052`](https://github.com/embed-team/embedly/commit/fc21052b89e65f5fd4d6a2dcdda4179516ca81e6)]:
  - @embedly/logging@0.5.0
  - @embedly/builder@0.5.0
  - @embedly/parser@0.5.0
  - @embedly/types@0.5.0

## 0.4.1

### Patch Changes

- [#8](https://github.com/embed-team/embedly/pull/8) [`4386504`](https://github.com/embed-team/embedly/commit/438650487368ec722bc75801ccf5f495be62a485) Thanks [@ItsRauf](https://github.com/ItsRauf)! - fix broken spoiler regex

- Updated dependencies [[`4386504`](https://github.com/embed-team/embedly/commit/438650487368ec722bc75801ccf5f495be62a485)]:
  - @embedly/builder@0.4.1
  - @embedly/parser@0.4.1
  - @embedly/logging@0.4.1
  - @embedly/types@0.4.1

## 0.4.0

### Minor Changes

- [#6](https://github.com/embed-team/embedly/pull/6) [`14785b7`](https://github.com/embed-team/embedly/commit/14785b70759445b7d402a3d63bca72993239f5b3) Thanks [@ItsRauf](https://github.com/ItsRauf)! - add a spoiler flag and support masked links in messages

### Patch Changes

- Updated dependencies [[`14785b7`](https://github.com/embed-team/embedly/commit/14785b70759445b7d402a3d63bca72993239f5b3)]:
  - @embedly/builder@0.4.0
  - @embedly/parser@0.4.0
  - @embedly/logging@0.4.0
  - @embedly/types@0.4.0

## 0.3.3

### Patch Changes

- [`6d3fccd`](https://github.com/embed-team/embedly/commit/6d3fccd8190a8b697e0ee93edc8c81affb036f01) Thanks [@ItsRauf](https://github.com/ItsRauf)! - added DX and CI tooling

- Updated dependencies [[`6d3fccd`](https://github.com/embed-team/embedly/commit/6d3fccd8190a8b697e0ee93edc8c81affb036f01)]:
  - @embedly/builder@0.3.3
  - @embedly/logging@0.3.3
  - @embedly/parser@0.3.3
  - @embedly/types@0.3.3

## 0.3.2

### Patch Changes

- fixed title for cbc embeds where username doesn't exist
- Updated dependencies
  - @embedly/builder@0.3.2
  - @embedly/logging@0.3.2
  - @embedly/parser@0.3.2
  - @embedly/types@0.3.2

## 0.3.1

### Patch Changes

- escape markdown in embed description
- Updated dependencies
  - @embedly/builder@0.3.1
  - @embedly/logging@0.3.1
  - @embedly/parser@0.3.1
  - @embedly/types@0.3.1

## 0.3.0

### Minor Changes

- added threads and fixed a few emoji issues

### Patch Changes

- Updated dependencies
  - @embedly/builder@0.3.0
  - @embedly/parser@0.3.0
  - @embedly/types@0.3.0
  - @embedly/logging@0.3.0

## 0.2.0

### Minor Changes

- added cbc.ca, fixed tiktok, added media proxy

### Patch Changes

- Updated dependencies
  - @embedly/builder@0.2.0
  - @embedly/logging@0.2.0
  - @embedly/parser@0.2.0
  - @embedly/types@0.2.0

## 0.1.4

### Patch Changes

- added a fallback error for random failures and added multi-embedding for messages
- Updated dependencies
  - @embedly/builder@0.1.4
  - @embedly/logging@0.1.4
  - @embedly/parser@0.1.4
  - @embedly/types@0.1.4

## 0.1.3

### Patch Changes

- fixed tiktok embeds and added new instagram share link handling
- Updated dependencies
  - @embedly/parser@0.1.3
  - @embedly/builder@0.1.3
  - @embedly/logging@0.1.3
  - @embedly/types@0.1.3

## 0.1.2

### Patch Changes

- rewrote api and bot embed handling to make the api only handle scraping
- Updated dependencies
  - @embedly/builder@0.1.2
  - @embedly/logging@0.1.2
  - @embedly/parser@0.1.2
  - @embedly/types@0.1.2

## 0.1.1

### Patch Changes

- added sidebar color to containers
- Updated dependencies
  - @embedly/builder@0.1.1
  - @embedly/logging@0.1.1
  - @embedly/parser@0.1.1
  - @embedly/types@0.1.1

## 0.1.0

### Minor Changes

- this is the first oss version of embedly :3

### Patch Changes

- Updated dependencies
  - @embedly/builder@0.1.0
  - @embedly/logging@0.1.0
  - @embedly/parser@0.1.0
  - @embedly/types@0.1.0
